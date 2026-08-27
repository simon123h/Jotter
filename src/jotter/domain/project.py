"""Project Domain Entity."""

from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Self

from jotter.domain.exceptions import ValidationError
from jotter.utils.slug import slugify


@dataclass
class Project:
    id: str  # Immutable slug / directory name (e.g. "default", "work")
    name: str  # Display name
    description: str = ""
    color: str | None = None
    git_remote: str | None = None
    position: float = 1000.0
    created_at: str = ""
    updated_at: str = ""

    def __post_init__(self):
        if not self.id or not self.id.strip():
            raise ValidationError("Project ID cannot be empty")
        if not self.name or not self.name.strip():
            raise ValidationError("Project name cannot be empty")
        now_str = datetime.now(timezone.utc).isoformat()
        if not self.created_at:
            self.created_at = now_str
        if not self.updated_at:
            self.updated_at = now_str

    @classmethod
    def create(
        cls,
        name: str,
        project_id: str | None = None,
        description: str = "",
        color: str | None = None,
        git_remote: str | None = None,
        position: float = 1000.0,
    ) -> Self:
        clean_name = name.strip()
        slug = project_id.strip() if project_id else slugify(clean_name)
        if not slug:
            slug = "project"
        now_str = datetime.now(timezone.utc).isoformat()
        return cls(
            id=slug,
            name=clean_name,
            description=description.strip() if description else "",
            color=color.strip() if color else None,
            git_remote=git_remote.strip() if git_remote else None,
            position=position,
            created_at=now_str,
            updated_at=now_str,
        )

    def touch(self) -> None:
        self.updated_at = datetime.now(timezone.utc).isoformat()

    def update_details(
        self,
        name: str | None = None,
        description: str | None = None,
        color: str | None = ...,
        git_remote: str | None = ...,
        position: float | None = None,
    ) -> None:
        changed = False

        if name is not None:
            clean_name = name.strip()
            if not clean_name:
                raise ValidationError("Project name cannot be empty")
            if self.name != clean_name:
                self.name = clean_name
                changed = True

        if description is not None:
            clean_desc = description.strip()
            if self.description != clean_desc:
                self.description = clean_desc
                changed = True

        if color is not ...:
            c_val = color.strip() if color else None
            if self.color != c_val:
                self.color = c_val
                changed = True

        if git_remote is not ...:
            r_val = git_remote.strip() if git_remote else None
            if self.git_remote != r_val:
                self.git_remote = r_val
                changed = True

        if position is not None and self.position != position:
            self.position = position
            changed = True

        if changed:
            self.touch()
