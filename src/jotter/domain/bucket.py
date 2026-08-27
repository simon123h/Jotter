"""Bucket (Column) Domain Entity."""

from dataclasses import dataclass
from typing import Any, Self

from jotter.domain.exceptions import ValidationError
from jotter.utils.slug import slugify


@dataclass
class Bucket:
    name: str  # Immutable identifier / slug (e.g. "todo", "in-progress")
    title: str  # Display title (e.g. "To Do")
    subtitle: str = ""
    position: float = 1000.0
    color: str | None = None
    layout: str = "list"
    max_tasks: int | None = None
    is_default: bool = False

    def __post_init__(self):
        if not self.name or not self.name.strip():
            raise ValidationError("Bucket name cannot be empty")
        if not self.title or not self.title.strip():
            raise ValidationError("Bucket title cannot be empty")

    @classmethod
    def create(
        cls,
        title: str,
        subtitle: str = "",
        position: float = 1000.0,
        color: str | None = None,
        layout: str = "list",
        max_tasks: int | None = None,
        is_default: bool = False,
        name: str | None = None,
    ) -> Self:
        clean_title = title.strip()
        slug = name.strip() if name else slugify(clean_title)
        if not slug:
            slug = "column"
        return cls(
            name=slug,
            title=clean_title,
            subtitle=subtitle.strip() if subtitle else "",
            position=position,
            color=color.strip() if color else None,
            layout=layout or "list",
            max_tasks=max_tasks,
            is_default=is_default,
        )

    def update_details(
        self,
        title: str | None = None,
        subtitle: str | None = None,
        position: float | None = None,
        color: str | None = ...,
        layout: str | None = None,
        max_tasks: int | None = ...,
        is_default: bool | None = None,
    ) -> None:
        if title is not None:
            clean_title = title.strip()
            if not clean_title:
                raise ValidationError("Bucket title cannot be empty")
            self.title = clean_title

        if subtitle is not None:
            self.subtitle = subtitle.strip()

        if position is not None:
            self.position = position

        if color is not ...:
            self.color = color.strip() if color else None

        if layout is not None:
            self.layout = layout or "list"

        if max_tasks is not ...:
            self.max_tasks = max_tasks

        if is_default is not None:
            self.is_default = is_default


DEFAULT_DOMAIN_BUCKETS: list[dict[str, Any]] = [
    {
        "name": "backlog",
        "title": "Backlog",
        "subtitle": "",
        "position": 1000.0,
        "is_default": True,
        "layout": "list",
        "color": None,
        "max_tasks": None,
    },
    {
        "name": "todo",
        "title": "To Do",
        "subtitle": "",
        "position": 2000.0,
        "is_default": False,
        "layout": "list",
        "color": None,
        "max_tasks": None,
    },
    {
        "name": "in-progress",
        "title": "In Progress",
        "subtitle": "",
        "position": 3000.0,
        "is_default": False,
        "layout": "list",
        "color": None,
        "max_tasks": None,
    },
    {
        "name": "done",
        "title": "Done",
        "subtitle": "",
        "position": 4000.0,
        "is_default": False,
        "layout": "list",
        "color": None,
        "max_tasks": None,
    },
    {
        "name": "archive",
        "title": "Archive",
        "subtitle": "",
        "position": 5000.0,
        "is_default": False,
        "layout": "list",
        "color": None,
        "max_tasks": None,
    },
]
