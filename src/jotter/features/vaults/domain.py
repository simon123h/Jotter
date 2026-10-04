"""Vault domain aggregate and value objects."""

from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Self

from jotter.shared.exceptions import ValidationError
from jotter.shared.slug import slugify


@dataclass
class Vault:
    """Represents an isolated physical storage directory for projects and tasks."""

    id: str
    name: str
    path: str
    is_active: bool = False
    created_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

    def __post_init__(self):
        if not self.id or not str(self.id).strip():
            raise ValidationError("Vault id cannot be empty")
        if not self.name or not str(self.name).strip():
            raise ValidationError("Vault name cannot be empty")
        if not self.path or not str(self.path).strip():
            raise ValidationError("Vault path cannot be empty")

        clean_path = str(Path(self.path).expanduser().resolve())
        object.__setattr__(self, "path", clean_path)

    @classmethod
    def create(
        cls,
        name: str,
        path: str | Path,
        vault_id: str | None = None,
    ) -> Self:
        clean_name = str(name).strip()
        vid = slugify(vault_id or clean_name)
        if not vid:
            vid = "vault"
        return cls(
            id=vid,
            name=clean_name,
            path=str(path),
            is_active=False,
        )

    @property
    def is_git(self) -> bool:
        return (Path(self.path) / ".git").is_dir()
