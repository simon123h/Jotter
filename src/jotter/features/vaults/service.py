"""Application service orchestrating vault operations and switching."""

import logging
from pathlib import Path
from typing import Any

from jotter.features.vaults.domain import Vault
from jotter.features.vaults.registry import VaultRegistry
from jotter.features.vaults.schemas import VaultCreate, VaultResponse
from jotter.shared.exceptions import ValidationError

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
        target_path.mkdir(parents=True, exist_ok=True)

        existing = [v for v in self.registry.get_all() if v.path == str(target_path)]
        if existing:
            raise ValidationError(f"Vault already registered for path '{target_path}' with ID '{existing[0].id}'")

        vault = Vault.create(
            name=req.name,
            path=target_path,
            vault_id=req.id,
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

    def delete_vault(self, vault_id: str) -> None:
        vault = self.registry.get(vault_id)
        all_vaults = self.registry.get_all()
        if len(all_vaults) <= 1:
            raise ValidationError("Cannot delete the only configured vault.")
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
            SyncApplicationService.from_data_dir(vault.path, new_conn).sync_db_only()
        except Exception as e:
            logger.warning("Reconciliation on vault switch failed: %s", e)

        # 4. Re-target FileWatcherService
        watcher = getattr(app_state, "watcher", None)
        if watcher is not None:
            try:
                watcher.stop()
                watcher.data_dir = Path(vault.path)
                watcher.start()
            except Exception as e:
                logger.warning("Failed to restart file watcher for vault %s: %s", vault.path, e)
