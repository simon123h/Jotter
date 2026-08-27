"""Task Domain Aggregate Root."""

from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Self

from jotter.shared.exceptions import ValidationError
from jotter.shared.value_objects import DueDate, Priority, Tag, TaskId


@dataclass
class Task:
    id: TaskId
    project_id: str
    title: str
    bucket: str
    position: float
    tags: list[Tag] = field(default_factory=list)
    attachments: list[str] = field(default_factory=list)
    body: str = ""
    due_date: DueDate = field(default_factory=lambda: DueDate(None))
    planned_date: DueDate = field(default_factory=lambda: DueDate(None))
    priority: Priority = Priority.NONE
    color: str | None = None
    postponed_until: DueDate = field(default_factory=lambda: DueDate(None))
    created_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updated_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

    def __post_init__(self):
        if not self.project_id or not self.project_id.strip():
            raise ValidationError("Task project_id cannot be empty")
        if not self.title or not self.title.strip():
            raise ValidationError("Task title cannot be empty")
        if not self.bucket or not self.bucket.strip():
            raise ValidationError("Task bucket cannot be empty")

    @classmethod
    def create(
        cls,
        project_id: str,
        title: str,
        bucket: str = "todo",
        position: float = 1000.0,
        tags: list[str] | None = None,
        attachments: list[str] | None = None,
        body: str = "",
        due_date: str | None = None,
        planned_date: str | None = None,
        priority: str | None = None,
        color: str | None = None,
        postponed_until: str | None = None,
        task_id: str | None = None,
    ) -> Self:
        clean_title = title.strip()
        if not clean_title:
            raise ValidationError("Task title cannot be empty")

        tid = TaskId.from_str(task_id) if task_id else TaskId.generate()
        now_str = datetime.now(timezone.utc).isoformat()

        clean_tags = [Tag(t) for t in tags] if tags else []
        clean_attachments = [a.strip() for a in attachments if a and a.strip()] if attachments else []

        return cls(
            id=tid,
            project_id=project_id.strip(),
            title=clean_title,
            bucket=bucket.strip() or "todo",
            position=position,
            tags=clean_tags,
            attachments=clean_attachments,
            body=body or "",
            due_date=DueDate.from_str(due_date),
            planned_date=DueDate.from_str(planned_date),
            priority=Priority.from_str(priority),
            color=color.strip() if color else None,
            postponed_until=DueDate.from_str(postponed_until),
            created_at=now_str,
            updated_at=now_str,
        )

    def move(
        self,
        target_bucket: str | None = None,
        new_position: float | None = None,
        *,
        new_bucket: str | None = None,
        position: float | None = None,
    ) -> None:
        effective_bucket = target_bucket or new_bucket or self.bucket
        effective_pos = (
            new_position if new_position is not None else (position if position is not None else self.position)
        )
        clean_bucket = effective_bucket.strip()
        if not clean_bucket:
            raise ValidationError("Target bucket cannot be empty")
        self.bucket = clean_bucket
        self.position = float(effective_pos)
        self.touch()

    def postpone(self, until: str) -> None:
        self.postponed_until = DueDate.from_str(until)
        self.touch()

    def unpostpone(self) -> None:
        self.postponed_until = DueDate(None)
        self.touch()

    def update_details(
        self,
        title: str | None = None,
        body: str | None = None,
        priority: str | None = ...,
        due_date: str | None = ...,
        planned_date: str | None = ...,
        color: str | None = ...,
        postponed_until: str | None = ...,
        tags: list[str] | None = None,
    ) -> None:
        if title is not None:
            clean_title = title.strip()
            if not clean_title:
                raise ValidationError("Task title cannot be empty")
            self.title = clean_title

        if body is not None:
            self.body = body

        if priority is not ...:
            self.priority = Priority.from_str(priority)

        if due_date is not ...:
            self.due_date = DueDate.from_str(due_date)

        if planned_date is not ...:
            self.planned_date = DueDate.from_str(planned_date)

        if color is not ...:
            self.color = color.strip() if color else None

        if postponed_until is not ...:
            self.postponed_until = DueDate.from_str(postponed_until)

        if tags is not None:
            self.tags = [Tag(t) for t in tags]

        self.touch()

    def add_attachment(self, filename: str) -> None:
        clean = filename.strip()
        if not clean:
            raise ValidationError("Attachment filename cannot be empty")
        if clean not in self.attachments:
            self.attachments.append(clean)
            self.touch()

    def remove_attachment(self, filename: str) -> None:
        clean = filename.strip()
        if clean in self.attachments:
            self.attachments.remove(clean)
            self.touch()

    def touch(self) -> None:
        self.updated_at = datetime.now(timezone.utc).isoformat()
