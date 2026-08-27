"""Task service facade delegating to TaskApplicationService for clean architecture."""

from pathlib import Path
from typing import BinaryIO

from jotter.application.services.task_service import TaskApplicationService
from jotter.domain.exceptions import EntityNotFoundError
from jotter.infrastructure.repositories.disk_task_repository import DiskTaskRepository
from jotter.models.task import (
    TaskCreate,
    TaskFrontmatter,
    TaskMove,
    TaskResponse,
    TaskUpdate,
)


def get_task_file_path(data_dir: str, project_id: str, task_id: str) -> Path:
    return DiskTaskRepository(data_dir).get_task_file_path(project_id, task_id)


def read_task_file(data_dir: str, project_id: str, task_id: str) -> tuple[TaskFrontmatter, str]:
    try:
        task = DiskTaskRepository(data_dir).get_task(project_id, task_id)
    except EntityNotFoundError as e:
        raise FileNotFoundError(str(e))

    fm = TaskFrontmatter(
        id=str(task.id),
        project_id=task.project_id,
        title=task.title,
        bucket=task.bucket,
        position=task.position,
        tags=[t.value for t in task.tags],
        attachments=task.attachments,
        due_date=task.due_date.value,
        planned_date=task.planned_date.value,
        priority=task.priority.value if task.priority.value != "none" else None,
        color=task.color,
        postponed_until=task.postponed_until.value,
        created_at=task.created_at,
        updated_at=task.updated_at,
    )
    return fm, task.body or ""


def dump_frontmatter(fm: TaskFrontmatter, body: str) -> str:
    repo = DiskTaskRepository("")
    task = repo.parse_task_content(
        content=f"---\n{fm.model_dump_json()}---\n{body}",
        fallback_id=fm.id,
        default_project_id=fm.project_id,
    )
    return repo.serialize_task(task)


def parse_frontmatter(content: str, fallback_id: str = "01", default_project_id: str = "default") -> tuple[TaskFrontmatter, str]:
    repo = DiskTaskRepository("")
    task = repo.parse_task_content(content, fallback_id, default_project_id)
    fm = TaskFrontmatter(
        id=str(task.id),
        project_id=task.project_id,
        title=task.title,
        bucket=task.bucket,
        position=task.position,
        tags=[t.value for t in task.tags],
        attachments=task.attachments,
        due_date=task.due_date.value,
        planned_date=task.planned_date.value,
        priority=task.priority.value if task.priority.value != "none" else None,
        color=task.color,
        postponed_until=task.postponed_until.value,
        created_at=task.created_at,
        updated_at=task.updated_at,
    )
    return fm, task.body or ""


def get_task(data_dir: str, project_id: str, task_id: str) -> TaskResponse | None:
    try:
        return TaskApplicationService(data_dir).get_task(project_id, task_id)
    except Exception:
        return None


def get_tasks(
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
) -> list[TaskResponse]:
    return TaskApplicationService("").get_tasks(
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
    )


def create_task(data_dir: str, project_id: str, req: TaskCreate) -> TaskResponse:
    return TaskApplicationService(data_dir).create_task(project_id, req)


def update_task(data_dir: str, project_id: str, task_id: str, req: TaskUpdate) -> TaskResponse:
    try:
        return TaskApplicationService(data_dir).update_task(project_id, task_id, req)
    except EntityNotFoundError as e:
        raise FileNotFoundError(str(e))


def move_task(data_dir: str, project_id: str, task_id: str, req: TaskMove) -> TaskResponse:
    try:
        return TaskApplicationService(data_dir).move_task(project_id, task_id, req)
    except EntityNotFoundError as e:
        raise FileNotFoundError(str(e))


def delete_task(data_dir: str, project_id: str, task_id: str) -> None:
    TaskApplicationService(data_dir).delete_task(project_id, task_id)


def get_attachment_path(data_dir: str, project_id: str, task_id: str, filename: str) -> Path:
    return Path(data_dir) / project_id / "attachments" / task_id / filename


def save_attachment(data_dir: str, project_id: str, task_id: str, filename: str, file_obj: BinaryIO) -> TaskResponse:
    content = file_obj.read()
    try:
        return TaskApplicationService(data_dir).add_attachment(project_id, task_id, filename, content)
    except EntityNotFoundError as e:
        raise FileNotFoundError(str(e))


def delete_attachment(data_dir: str, project_id: str, task_id: str, filename: str) -> TaskResponse:
    try:
        return TaskApplicationService(data_dir).remove_attachment(project_id, task_id, filename)
    except EntityNotFoundError as e:
        raise FileNotFoundError(str(e))
