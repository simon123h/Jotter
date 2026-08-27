"""Project Domain Entity."""

from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Self

from jotter.shared.exceptions import ValidationError
from jotter.shared.slug import slugify


@dataclass
class Project:
    id: str  # Immutable directory / workspace slug (e.g. "default", "work-tasks")
    name: str  # Display name / title (e.g. "Default", "Work & Office")
    description: str = ""
    git_remote: str | None = None
    created_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

    def __post_init__(self):
        if not self.id or not self.id.strip():
            raise ValidationError("Project id cannot be empty")
        if not self.name or not self.name.strip():
            raise ValidationError("Project name cannot be empty")

    @classmethod
    def create(
        cls,
        name: str,
        project_id: str | None = None,
        description: str = "",
        git_remote: str | None = None,
        **kwargs: Any,
    ) -> Self:
        clean_name = name.strip()
        if not clean_name:
            raise ValidationError("Project name cannot be empty")

        slug = project_id.strip() if project_id else slugify(clean_name)
        if not slug:
            slug = "project"

        return cls(
            id=slug,
            name=clean_name,
            description=description.strip() if description else "",
            git_remote=git_remote.strip() if git_remote else None,
            created_at=datetime.now(timezone.utc).isoformat(),
        )

    def update_details(
        self,
        name: str | None = None,
        description: str | None = None,
        git_remote: str | None = ...,
    ) -> None:
        if name is not None:
            clean_name = name.strip()
            if not clean_name:
                raise ValidationError("Project name cannot be empty")
            self.name = clean_name

        if description is not None:
            self.description = description.strip()

        if git_remote is not ...:
            self.git_remote = git_remote.strip() if git_remote else None
