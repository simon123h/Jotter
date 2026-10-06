"""Composite Application Service providing unified access to Task commands and queries.

Delegates to TaskCommandService (writes + projections) and TaskQueryService (reads).
"""

import sqlite3
from pathlib import Path
from typing import Self, Unpack

from jotter.features.buckets.repo import BucketRepository
from jotter.features.projects.repo import ProjectRepository
from jotter.features.tasks.command_service import TaskCommandService
from jotter.features.tasks.disk_repo import DiskTaskRepository
from jotter.features.tasks.projector import TaskProjector
from jotter.features.tasks.query_service import TaskQueryService
from jotter.features.tasks.schemas import (
    TaskCreate,
    TaskFilters,
    TaskMove,
    TaskResponse,
    TaskUpdate,
)
from jotter.features.tasks.sqlite_repo import SqliteTaskRepository


class TaskApplicationService:
    """Facade delegating commands to TaskCommandService and queries to TaskQueryService."""

    def __init__(
        self,
        disk_repo: DiskTaskRepository,
        sqlite_repo: SqliteTaskRepository,
        bucket_repo: BucketRepository,
        project_repo: ProjectRepository,
        projector: TaskProjector | None = None,
    ):
        self.disk_repo = disk_repo
        self.sqlite_repo = sqlite_repo
        self.bucket_repo = bucket_repo
        self.project_repo = project_repo
        self.projector = projector or getattr(sqlite_repo, "_projector", None) or TaskProjector(sqlite_repo.conn)

        self.commands = TaskCommandService(
            disk_repo=self.disk_repo,
            projector=self.projector,
            bucket_repo=self.bucket_repo,
            project_repo=self.project_repo,
        )
        self.queries = TaskQueryService(sqlite_repo=self.sqlite_repo)

    @classmethod
    def from_data_dir(cls, data_dir: Path | str, conn: sqlite3.Connection) -> Self:
        return cls(
            disk_repo=DiskTaskRepository(data_dir),
            sqlite_repo=SqliteTaskRepository(conn),
            bucket_repo=BucketRepository(data_dir, conn),
            project_repo=ProjectRepository(data_dir, conn),
            projector=TaskProjector(conn),
        )

    # --- Query Delegations ---

    def get_task(self, project_id: str, task_id: str) -> TaskResponse:
        return self.queries.get_task(project_id, task_id)

    def get_tasks(self, project_id: str | None = None, **kwargs: Unpack[TaskFilters]) -> list[TaskResponse]:
        return self.queries.get_tasks(project_id=project_id, **kwargs)

    # --- Command Delegations ---

    def create_task(self, project_id: str, req: TaskCreate) -> TaskResponse:
        return self.commands.create_task(project_id, req)

    def update_task(self, project_id: str, task_id: str, req: TaskUpdate) -> TaskResponse:
        return self.commands.update_task(project_id, task_id, req)

    def move_task(self, project_id: str, task_id: str, req: TaskMove) -> TaskResponse:
        return self.commands.move_task(project_id, task_id, req)

    def delete_task(self, project_id: str, task_id: str) -> None:
        self.commands.delete_task(project_id, task_id)

    def add_attachment(self, project_id: str, task_id: str, filename: str, content_bytes: bytes) -> TaskResponse:
        return self.commands.add_attachment(project_id, task_id, filename, content_bytes)

    def remove_attachment(self, project_id: str, task_id: str, filename: str) -> TaskResponse:
        return self.commands.remove_attachment(project_id, task_id, filename)
