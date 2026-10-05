"""Registry repository for discovering and persisting configured vaults."""

import json
import logging
from pathlib import Path
from typing import Any

from jotter.config import get_config_dir
from jotter.features.vaults.domain import Vault
from jotter.shared.exceptions import EntityNotFoundError

logger = logging.getLogger(__name__)


def get_default_vaults_config_path() -> Path:
    """Returns the persistent global path for vaults.json."""
    base = get_config_dir()
    base.mkdir(parents=True, exist_ok=True)
    return base / "vaults.json"


class VaultRegistry:
    """Manages persistence of known vaults and tracks active vault."""

    def __init__(self, config_file: Path | str | None = None, default_data_dir: str | None = None):
        self.config_file = Path(config_file) if config_file else get_default_vaults_config_path()
        self.default_data_dir = default_data_dir

    def _load_data(self) -> dict[str, Any]:
        if not self.config_file.is_file():
            return {"active_vault": None, "vaults": []}
        try:
            with open(self.config_file, encoding="utf-8") as f:
                data = json.load(f)
                if isinstance(data, dict):
                    return data
        except Exception as e:
            logger.warning("Failed to load vaults configuration from %s: %s", self.config_file, e)
        return {"active_vault": None, "vaults": []}

    def _save_data(self, data: dict[str, Any]) -> None:
        self.config_file.parent.mkdir(parents=True, exist_ok=True)
        from jotter.shared.fs import atomic_write

        atomic_write(self.config_file, json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")

    def get_all(self) -> list[Vault]:
        data = self._load_data()
        active_id = data.get("active_vault")
        raw_vaults = data.get("vaults", [])

        # Auto-seed default vault if registry is empty
        if not raw_vaults and self.default_data_dir:
            default_v = Vault.create(
                name="Default Vault",
                path=self.default_data_dir,
                vault_id="default",
            )
            default_v.is_active = True
            self.save(default_v)
            self.set_active_id(default_v.id)
            return [default_v]

        vaults: list[Vault] = []
        for rv in raw_vaults:
            try:
                v = Vault(
                    id=rv["id"],
                    name=rv["name"],
                    path=rv["path"],
                    is_active=(rv["id"] == active_id),
                    created_at=rv.get("created_at") or "",
                )
                vaults.append(v)
            except Exception as e:
                logger.warning("Skipping invalid vault entry in %s: %s", self.config_file, e)

        # If no active vault is designated, default to the first vault
        if vaults and not any(v.is_active for v in vaults):
            vaults[0].is_active = True
            self.set_active_id(vaults[0].id)

        return vaults

    def get(self, vault_id: str) -> Vault:
        for v in self.get_all():
            if v.id == vault_id:
                return v
        raise EntityNotFoundError(f"Vault '{vault_id}' not found")

    def get_active(self) -> Vault:
        vaults = self.get_all()
        for v in vaults:
            if v.is_active:
                return v
        if vaults:
            return vaults[0]
        # Fallback if completely empty
        path = self.default_data_dir or str(Path.cwd() / "tasks")
        v = Vault.create(name="Default Vault", path=path, vault_id="default")
        v.is_active = True
        return v

    def resolve(self, ref: str | None = None) -> Vault:
        """Finds a vault by id or (case-insensitive) name; with no ref, returns the active vault."""
        if ref is None:
            return self.get_active()
        vaults = self.get_all()
        for v in vaults:
            if v.id == ref:
                return v
        wanted = ref.strip().casefold()
        for v in vaults:
            if v.name.casefold() == wanted:
                return v
        available = ", ".join(f"'{v.name}' (id: {v.id})" for v in vaults) or "none"
        raise EntityNotFoundError(f"Vault '{ref}' not found. Available vaults: {available}")

    def save(self, vault: Vault) -> None:
        data = self._load_data()
        raw_vaults = data.get("vaults", [])
        existing_idx = None
        for i, rv in enumerate(raw_vaults):
            if rv["id"] == vault.id:
                existing_idx = i
                break

        entry = {
            "id": vault.id,
            "name": vault.name,
            "path": vault.path,
            "created_at": vault.created_at,
        }

        if existing_idx is not None:
            raw_vaults[existing_idx] = entry
        else:
            raw_vaults.append(entry)

        data["vaults"] = raw_vaults
        if vault.is_active or not data.get("active_vault"):
            data["active_vault"] = vault.id
        self._save_data(data)

    def set_active_id(self, vault_id: str) -> None:
        data = self._load_data()
        data["active_vault"] = vault_id
        self._save_data(data)

    def delete(self, vault_id: str) -> None:
        data = self._load_data()
        data["vaults"] = [rv for rv in data.get("vaults", []) if rv["id"] != vault_id]
        if data.get("active_vault") == vault_id:
            data["active_vault"] = data["vaults"][0]["id"] if data["vaults"] else None
        self._save_data(data)
