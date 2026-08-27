"""Task Aggregate Root / Domain Entity."""

from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Self

from jotter.domain.exceptions import ValidationError
from jotter.domain.value_objects import DueDate, Priority, Tag, TaskId


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
        if not self.title or not self.title.strip():
            raise ValidationError("Task title cannot be empty")
        if not self.project_id or not self.project_id.strip():
            raise ValidationError("Project ID cannot be empty")
        if not self.bucket or not self.bucket.strip():
            raise ValidationError("Bucket cannot be empty")

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
        tid = TaskId(task_id) if task_id else TaskId.generate()
        tag_vos = [Tag(t) for t in (tags or []) if t and str(t).strip()]
        clean_attachments = [a for a in (attachments or []) if a and str(a).strip()]

        now_str = datetime.now(timezone.utc).isoformat()
        return cls(
            id=tid,
            project_id=project_id.strip(),
            title=title.strip(),
            bucket=bucket.strip(),
            position=position,
            tags=tag_vos,
            attachments=clean_attachments,
            body=body,
            due_date=DueDate(due_date.strip() if due_date else None),
            planned_date=DueDate(planned_date.strip() if planned_date else None),
            priority=Priority.from_str(priority),
            color=color.strip() if color else None,
            postponed_until=DueDate(postponed_until.strip() if postponed_until else None),
            created_at=now_str,
            updated_at=now_str,
        )

    def touch(self) -> None:
        """Updates the updated_at timestamp to current UTC time."""
        self.updated_at = datetime.now(timezone.utc).isoformat()

    def update_details(
        self,
        title: str | None = None,
        body: str | None = None,
        priority: str | None = None,
        due_date: str | None = ...,  # Ellipsis means unchanged, None means cleared
        planned_date: str | None = ...,
        color: str | None = ...,
        postponed_until: str | None = ...,
        tags: list[str] | None = None,
    ) -> None:
        changed = False

        if title is not None:
            clean_title = title.strip()
            if not clean_title:
                raise ValidationError("Task title cannot be empty")
            if self.title != clean_title:
                self.title = clean_title
                changed = True

        if body is not None and self.body != body:
            self.body = body
            changed = True

        if priority is not None:
            p_vo = Priority.from_str(priority)
            if self.priority != p_vo:
                self.priority = p_vo
                changed = True

        if due_date is not ...:
            d_vo = DueDate(due_date.strip() if due_date else None)
            if self.due_date != d_vo:
                self.due_date = d_vo
                changed = True

        if planned_date is not ...:
            pl_vo = DueDate(planned_date.strip() if planned_date else None)
            if self.planned_date != pl_vo:
                self.planned_date = pl_vo
                changed = True

        if color is not ...:
            c_val = color.strip() if color else None
            if self.color != c_val:
                self.color = c_val
                changed = True

        if postponed_until is not ...:
            po_vo = DueDate(postponed_until.strip() if postponed_until else None)
            if self.postponed_until != po_vo:
                self.postponed_until = po_vo
                changed = True

        if tags is not None:
            new_tags = [Tag(t) for t in tags if t and str(t).strip()]
            if [t.value for t in self.tags] != [t.value for t in new_tags]:
                self.tags = new_tags
                changed = True

        if changed:
            self.touch()

    def move(self, new_bucket: str, new_position: float) -> None:
        """Moves task to a target bucket and assigns a new sorting position."""
        clean_bucket = new_bucket.strip()
        if not clean_bucket:
            raise ValidationError("Target bucket cannot be empty")

        if self.bucket != clean_bucket or self.position != new_position:
            self.bucket = clean_bucket
            self.position = new_position
            self.touch()

    def postpone(self, until_date_str: str) -> None:
        """Postpones task until a specified future date."""
        d_vo = DueDate(until_date_str)
        self.postponed_until = d_vo
        self.touch()

    def unpostpone(self) -> None:
        """Removes postponement from task."""
        if self.postponed_until.value is not None:
            self.postponed_until = DueDate(None)
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
