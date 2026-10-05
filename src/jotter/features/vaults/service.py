"""Application service orchestrating vault operations and switching."""

import logging
from pathlib import Path
from typing import Any

from jotter.features.vaults.domain import Vault
from jotter.features.vaults.registry import VaultRegistry
from jotter.features.vaults.schemas import VaultCreate, VaultResponse, VaultUpdate
from jotter.shared.exceptions import ValidationError
from jotter.shared.slug import slugify

logger = logging.getLogger(__name__)


class VaultApplicationService:
    """Service managing vault lifecycle and switching active vault."""

    def __init__(self, registry: VaultRegistry):
        self.registry = registry

    def list_vaults(self) -> list[VaultResponse]:
        vaults = self.registry.get_all()
        return [
            VaultResponse(
                id=v.id,
                name=v.name,
                path=v.path,
                is_active=v.is_active,
                is_git=v.is_git,
                created_at=v.created_at,
            )
            for v in vaults
        ]

    def get_active_vault(self) -> VaultResponse:
        v = self.registry.get_active()
        return VaultResponse(
            id=v.id,
            name=v.name,
            path=v.path,
            is_active=True,
            is_git=v.is_git,
            created_at=v.created_at,
        )

    def create_vault(self, req: VaultCreate) -> VaultResponse:
        target_path = Path(req.path).expanduser().resolve()
        if target_path.exists() and not target_path.is_dir():
            raise ValidationError(f"Path '{target_path}' is not a directory")
        if not target_path.exists() and not req.create_dir:
            raise ValidationError(f"Folder '{target_path}' does not exist")
        target_path.mkdir(parents=True, exist_ok=True)

        existing = [v for v in self.registry.get_all() if v.path == str(target_path)]
        if existing:
            raise ValidationError(f"Vault already registered for path '{target_path}' with ID '{existing[0].id}'")

        taken_ids = {v.id for v in self.registry.get_all()}
        if req.id:
            vault_id = slugify(req.id)
            if vault_id in taken_ids:
                raise ValidationError(f"Vault ID '{req.id}' is already in use")
        else:
            base = slugify(req.name) or "vault"
            vault_id, n = base, 2
            while vault_id in taken_ids:
                vault_id = f"{base}-{n}"
                n += 1

        vault = Vault.create(
            name=req.name,
            path=target_path,
            vault_id=vault_id,
        )
        self.registry.save(vault)
        return VaultResponse(
            id=vault.id,
            name=vault.name,
            path=vault.path,
            is_active=vault.is_active,
            is_git=vault.is_git,
            created_at=vault.created_at,
        )

    def switch_vault(self, vault_id: str, app_state: Any = None) -> VaultResponse:
        """Switches the active vault.

        If FastAPI app_state is provided, updates DB connection, resets watcher, and runs initial sync.
        """
        vault = self.registry.get(vault_id)
        self.registry.set_active_id(vault.id)

        if app_state is not None:
            self._rebind_runtime_state(app_state, vault)

        return VaultResponse(
            id=vault.id,
            name=vault.name,
            path=vault.path,
            is_active=True,
            is_git=vault.is_git,
            created_at=vault.created_at,
        )

    def rename_vault(self, vault_id: str, req: VaultUpdate) -> VaultResponse:
        vault = self.registry.get(vault_id)
        name = req.name.strip()
        if not name:
            raise ValidationError("Vault name cannot be empty")
        vault.name = name
        self.registry.save(vault)
        return VaultResponse(
            id=vault.id,
            name=vault.name,
            path=vault.path,
            is_active=vault.is_active,
            is_git=vault.is_git,
            created_at=vault.created_at,
        )

    def delete_vault(self, vault_id: str, app_state: Any = None) -> None:
        """Unregisters a vault (files on disk are never touched).

        Removing the active vault switches to another one first so runtime state stays consistent.
        """
        vault = self.registry.get(vault_id)
        remaining = [v for v in self.registry.get_all() if v.id != vault.id]
        if not remaining:
            raise ValidationError("Cannot remove the only configured vault.")
        if vault.is_active:
            self.switch_vault(remaining[0].id, app_state=app_state)
        self.registry.delete(vault.id)

    def _rebind_runtime_state(self, app_state: Any, vault: Vault) -> None:
        """Rebinds runtime dependencies (DB, watcher, config) when active vault changes."""
        from jotter.features.sync.service import SyncApplicationService
        from jotter.shared.db import close_db, create_sqlite_connection

        # 1. Update active config data_dir
        if hasattr(app_state, "config"):
            app_state.config.data_dir = vault.path

        # 2. Update DB connection
        new_db_path = str(Path(vault.path) / "tasks.db")
        old_conn = getattr(app_state, "db", None)
        if old_conn:
            try:
                old_conn.close()
            except Exception:
                pass
        close_db()

        app_state.db_path = new_db_path
        new_conn = create_sqlite_connection(new_db_path)
        app_state.db = new_conn

        # 3. Synchronize new vault SQLite index
        try:
            SyncApplicationService.from_data_dir(vault.path, new_conn).sync_on_startup()
        except Exception as e:
            logger.warning("Reconciliation on vault switch failed: %s", e)

        # 4. Re-target FileWatcherService
        scheduler = getattr(app_state, "auto_commit", None)
        if scheduler is not None:
            try:
                scheduler.retarget(vault.path)
            except Exception as e:
                logger.warning("Failed to retarget auto-commit for vault %s: %s", vault.path, e)

        watcher = getattr(app_state, "watcher", None)
        if watcher is not None:
            try:
                watcher.stop()
                watcher.data_dir = Path(vault.path)
                watcher.start()
            except Exception as e:
                logger.warning("Failed to restart file watcher for vault %s: %s", vault.path, e)
