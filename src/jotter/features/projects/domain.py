"""Project Domain Entity."""

from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Self

from jotter.shared.exceptions import ValidationError
from jotter.shared.slug import slugify
from jotter.shared.unset import UNSET, Unset


@dataclass
class Project:
    id: str  # Immutable directory / workspace slug (e.g. "default", "work-tasks")
    name: str  # Display name / title (e.g. "Default", "Work & Office")
    description: str = ""
    done_clean_period: int | None = None
    created_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

    def __post_init__(self) -> None:
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
        done_clean_period: int | None = None,
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
            done_clean_period=done_clean_period,
            created_at=datetime.now(timezone.utc).isoformat(),
        )

    def update_details(
        self,
        name: str | None = None,
        description: str | None = None,
        done_clean_period: int | Unset | None = UNSET,
    ) -> None:
        if name is not None:
            clean_name = name.strip()
            if not clean_name:
                raise ValidationError("Project name cannot be empty")
            self.name = clean_name

        if description is not None:
            self.description = description.strip()

        if done_clean_period is not UNSET:
            self.done_clean_period = done_clean_period
