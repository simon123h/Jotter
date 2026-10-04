"""Query application service orchestrating Task read operations."""

import sqlite3
from pathlib import Path
from typing import Self

from jotter.features.tasks.domain import Task
from jotter.features.tasks.schemas import TaskResponse
from jotter.features.tasks.sqlite_repo import SqliteTaskRepository
from jotter.shared.value_objects import Priority


class TaskQueryService:
    """Read-only service that queries the SQLite projection read-model.

    Never interacts with disk files and has zero write side-effects.
    """

    def __init__(self, sqlite_repo: SqliteTaskRepository):
        self.sqlite_repo = sqlite_repo

    @classmethod
    def from_conn(cls, conn: sqlite3.Connection) -> Self:
        return cls(sqlite_repo=SqliteTaskRepository(conn))

    @classmethod
    def from_data_dir(cls, _data_dir: Path | str, conn: sqlite3.Connection) -> Self:
        return cls(sqlite_repo=SqliteTaskRepository(conn))

    def get_task(self, project_id: str, task_id: str) -> TaskResponse:
        task = self.sqlite_repo.get_by_id(project_id, task_id)
        return self._to_response(task)

    def get_tasks(
        self,
        project_id: str | None = None,
        bucket: str | None = None,
        buckets: list[str] | None = None,
        tag: str | None = None,
        tags: list[str] | None = None,
        tag_mode: str = "any",
        exclude_bucket: str | None = None,
        exclude_buckets: list[str] | None = None,
        priorities: list[str] | None = None,
        search: str | None = None,
        due_before: str | None = None,
        due_after: str | None = None,
        planned_date: str | None = None,
        has_due_date: bool | None = None,
        created_before: str | None = None,
        created_after: str | None = None,
        updated_before: str | None = None,
        updated_after: str | None = None,
    ) -> list[TaskResponse]:
        tasks = self.sqlite_repo.find_tasks(
            project_id=project_id,
            bucket=bucket,
            buckets=buckets,
            tag=tag,
            tags=tags,
            tag_mode=tag_mode,
            exclude_bucket=exclude_bucket,
            exclude_buckets=exclude_buckets,
            priorities=priorities,
            search=search,
            due_before=due_before,
            due_after=due_after,
            planned_date=planned_date,
            has_due_date=has_due_date,
            created_before=created_before,
            created_after=created_after,
            updated_before=updated_before,
            updated_after=updated_after,
        )
        return [self._to_response(t) for t in tasks]

    def _to_response(self, task: Task) -> TaskResponse:
        return TaskResponse(
            id=str(task.id),
            project_id=task.project_id,
            title=task.title,
            bucket=task.bucket,
            position=float(task.position),
            tags=[t.value for t in task.tags],
            attachments=list(task.attachments),
            body=task.body or "",
            due_date=task.due_date.value,
            planned_date=task.planned_date.value,
            priority=task.priority.value if task.priority != Priority.NONE else None,
            color=task.color,
            postponed_until=task.postponed_until.value,
            created_at=task.created_at,
            updated_at=task.updated_at,
        )
