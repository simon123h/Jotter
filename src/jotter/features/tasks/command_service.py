"""Command application service orchestrating Task mutations and domain invariants."""

import shutil
import sqlite3
from pathlib import Path
from typing import Self

from jotter.features.buckets.domain import Bucket
from jotter.features.buckets.repo import BucketRepository
from jotter.features.projects.repo import ProjectRepository
from jotter.features.tasks.disk_repo import DiskTaskRepository
from jotter.features.tasks.domain import Priority, Task
from jotter.features.tasks.projector import TaskProjector
from jotter.features.tasks.schemas import (
    TaskCreate,
    TaskMove,
    TaskResponse,
    TaskUpdate,
)
from jotter.shared.exceptions import EntityNotFoundError


class TaskCommandService:
    """Write-only command service for task mutations.

    Enforces domain invariants, persists authoritative state to disk (SSoT Markdown files),
    and executes synchronous in-process projections to the SQLite read-model for zero-latency consistency.
    """

    def __init__(
        self,
        disk_repo: DiskTaskRepository,
        projector: TaskProjector,
        bucket_repo: BucketRepository,
        project_repo: ProjectRepository,
    ):
        self.disk_repo = disk_repo
        self.projector = projector
        self.bucket_repo = bucket_repo
        self.project_repo = project_repo

    @classmethod
    def from_data_dir(cls, data_dir: Path | str, conn: sqlite3.Connection) -> Self:
        return cls(
            disk_repo=DiskTaskRepository(data_dir),
            projector=TaskProjector(conn),
            bucket_repo=BucketRepository(data_dir, conn),
            project_repo=ProjectRepository(data_dir, conn),
        )

    def create_task(self, project_id: str, req: TaskCreate) -> TaskResponse:
        if not self.project_repo.exists(project_id):
            raise EntityNotFoundError(f"Project '{project_id}' not found")

        # Determine target bucket
        buckets = self.bucket_repo.get_all(project_id)
        known_bucket_names = {b.name for b in buckets}

        target_bucket = req.bucket
        if not target_bucket:
            default_b = next((b for b in buckets if b.is_default), None)
            target_bucket = default_b.name if default_b else (buckets[0].name if buckets else "todo")

        # Auto-create bucket if missing
        if target_bucket not in known_bucket_names:
            new_b = Bucket.create(title=target_bucket.capitalize(), name=target_bucket)
            self.bucket_repo.save(project_id, new_b)

        # Calculate position if not provided
        position = getattr(req, "position", None)
        if position is None:
            # Read the highest position from the index: scanning every task file is O(tasks) file opens
            max_pos = self.projector.max_position(project_id, target_bucket)
            position = 1000.0 if max_pos is None else max_pos + 1000.0

        attachments = getattr(req, "attachments", None) or []

        task = Task.create(
            project_id=project_id,
            title=req.title,
            bucket=target_bucket,
            position=position,
            tags=req.tags,
            attachments=attachments,
            body=req.body or "",
            due_date=req.due_date,
            planned_date=req.planned_date,
            priority=req.priority,
            color=req.color,
            postponed_until=req.postponed_until,
        )

        # 1. Authoritative write to Markdown file on disk (SSoT)
        self.disk_repo.save(task)

        # 2. Synchronous in-process projection to SQLite read model (0ms latency)
        self.projector.project_task_upsert(task)

        return self._to_response(task)

    def update_task(self, project_id: str, task_id: str, req: TaskUpdate) -> TaskResponse:
        task = self.disk_repo.get_task(project_id, task_id)
        fields_set = req.model_fields_set

        target_project_id = (
            req.project_id if ("project_id" in fields_set and req.project_id and req.project_id.strip()) else project_id
        )
        target_bucket = req.bucket or task.bucket

        known = {b.name for b in self.bucket_repo.get_all(target_project_id)}
        if target_bucket not in known:
            new_b = Bucket.create(title=target_bucket.capitalize(), name=target_bucket)
            self.bucket_repo.save(target_project_id, new_b)

        task.update_details(
            title=req.title if "title" in fields_set else None,
            body=req.body if "body" in fields_set else None,
            priority=req.priority if "priority" in fields_set else ...,
            due_date=req.due_date if "due_date" in fields_set else ...,
            planned_date=req.planned_date if "planned_date" in fields_set else ...,
            color=req.color if "color" in fields_set else ...,
            postponed_until=req.postponed_until if "postponed_until" in fields_set else ...,
            tags=req.tags if "tags" in fields_set else None,
        )
        if "attachments" in fields_set and req.attachments is not None:
            task.attachments = req.attachments

        if "bucket" in fields_set and req.bucket and req.bucket != task.bucket:
            task.move(req.bucket, req.position if req.position is not None else task.position)
        elif "position" in fields_set and req.position is not None:
            task.move(task.bucket, req.position)

        if target_project_id != project_id:
            if not self.project_repo.exists(target_project_id):
                raise EntityNotFoundError(f"Project '{target_project_id}' not found")

            # Update domain entity project_id
            task.project_id = target_project_id

            # 1. Authoritative persist on disk in target project first (prevents data loss if killed mid-operation)
            self.disk_repo.save(task)

            # 2. Move attachments directory to target project
            old_attach_dir = self.disk_repo.get_project_dir(project_id) / "attachments" / task_id
            if old_attach_dir.is_dir():
                new_attach_dir = self.disk_repo.get_project_dir(target_project_id) / "attachments" / task_id
                new_attach_dir.parent.mkdir(parents=True, exist_ok=True)
                if new_attach_dir.exists():
                    shutil.rmtree(new_attach_dir)
                shutil.move(str(old_attach_dir), str(new_attach_dir))

            # 3. Only delete old markdown file from source project after new file is persisted
            self.disk_repo.delete(project_id, task_id)
        else:
            # 1. Authoritative persist on disk
            self.disk_repo.save(task)

        # 2. Synchronous read-model projection
        self.projector.project_task_upsert(task)

        return self._to_response(task)

    def move_task(self, project_id: str, task_id: str, req: TaskMove) -> TaskResponse:
        task = self.disk_repo.get_task(project_id, task_id)

        target_bucket = req.bucket or task.bucket
        target_pos = req.position if req.position is not None else task.position

        # Ensure bucket exists
        known = {b.name for b in self.bucket_repo.get_all(project_id)}
        if target_bucket not in known:
            new_b = Bucket.create(title=target_bucket.capitalize(), name=target_bucket)
            self.bucket_repo.save(project_id, new_b)

        task.move(target_bucket, target_pos)

        # 1. Authoritative persist on disk
        self.disk_repo.save(task)

        # 2. Synchronous read-model projection
        self.projector.project_task_upsert(task)

        return self._to_response(task)

    def delete_task(self, project_id: str, task_id: str) -> None:
        self.disk_repo.delete(project_id, task_id)
        self.projector.project_task_delete(task_id)

    def add_attachment(self, project_id: str, task_id: str, filename: str, content_bytes: bytes) -> TaskResponse:
        task = self.disk_repo.get_task(project_id, task_id)

        # Write attachment file to project attachments folder
        attach_dir = self.disk_repo.get_project_dir(project_id) / "attachments" / task_id
        attach_dir.mkdir(parents=True, exist_ok=True)
        file_path = attach_dir / filename
        file_path.write_bytes(content_bytes)

        task.add_attachment(filename)

        self.disk_repo.save(task)
        self.projector.project_task_upsert(task)

        return self._to_response(task)

    def remove_attachment(self, project_id: str, task_id: str, filename: str) -> TaskResponse:
        task = self.disk_repo.get_task(project_id, task_id)

        attach_path = self.disk_repo.get_project_dir(project_id) / "attachments" / task_id / filename
        if attach_path.is_file():
            attach_path.unlink()

        task.remove_attachment(filename)

        self.disk_repo.save(task)
        self.projector.project_task_upsert(task)

        return self._to_response(task)

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
