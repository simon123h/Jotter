"""FastAPI routes for Tasks and Attachments."""

import sqlite3
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile
from fastapi.responses import FileResponse

from jotter.features.tasks.schemas import TaskCreate, TaskMove, TaskResponse, TaskUpdate
from jotter.features.tasks.service import TaskApplicationService
from jotter.shared.deps import get_data_dir, get_db_conn

router = APIRouter(tags=["tasks"])


def get_task_service(
    data_dir: str = Depends(get_data_dir),
    conn: sqlite3.Connection = Depends(get_db_conn),
) -> TaskApplicationService:
    return TaskApplicationService.from_data_dir(data_dir, conn)


def _extract_query_param(request: Request, *names: str, default: str | None = None) -> str | None:
    for name in names:
        val = request.query_params.get(name)
        if val is not None:
            return val
    return default


def _extract_query_list(request: Request, *names: str) -> list[str] | None:
    for name in names:
        val_list = request.query_params.getlist(name)
        if val_list:
            items: list[str] = []
            for v in val_list:
                items.extend([i.strip() for i in v.split(",") if i.strip()])
            if items:
                return items
    return None


# Global tasks endpoint - full filtering support
@router.get("/api/tasks", response_model=list[TaskResponse])
def list_all_tasks(request: Request, svc: TaskApplicationService = Depends(get_task_service)):
    project_id = _extract_query_param(request, "projectId", "project_id", "project")
    bucket = _extract_query_param(request, "bucket")
    buckets = _extract_query_list(request, "buckets", "bucket")
    tag = _extract_query_param(request, "tag")
    tags = _extract_query_list(request, "tags", "tag")
    tag_mode = _extract_query_param(request, "tagMode", "tag_mode", default="any") or "any"
    exclude_bucket = _extract_query_param(request, "excludeBucket", "exclude_bucket")
    exclude_buckets = _extract_query_list(request, "excludeBuckets", "exclude_buckets")
    priorities = _extract_query_list(request, "priorities", "priority")
    search = _extract_query_param(request, "search")
    due_before = _extract_query_param(request, "dueBefore", "due_before")
    due_after = _extract_query_param(request, "dueAfter", "due_after")
    planned_date = _extract_query_param(request, "plannedDate", "planned_date")

    has_due_str = _extract_query_param(request, "hasDueDate", "has_due_date")
    has_due_date = None
    if has_due_str is not None:
        has_due_date = has_due_str.lower() in ("true", "1", "yes")

    return svc.get_tasks(
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


# Project tasks endpoint
@router.get("/api/projects/{project_id}/tasks", response_model=list[TaskResponse])
def list_project_tasks(project_id: str, request: Request, svc: TaskApplicationService = Depends(get_task_service)):
    bucket = _extract_query_param(request, "bucket")
    buckets = _extract_query_list(request, "buckets")
    tag = _extract_query_param(request, "tag")
    tags = _extract_query_list(request, "tags")
    tag_mode = _extract_query_param(request, "tagMode", "tag_mode", default="any") or "any"
    exclude_bucket = _extract_query_param(request, "excludeBucket", "exclude_bucket")
    exclude_buckets = _extract_query_list(request, "excludeBuckets", "exclude_buckets")
    priorities = _extract_query_list(request, "priorities", "priority")
    search = _extract_query_param(request, "search")
    due_before = _extract_query_param(request, "dueBefore", "due_before")
    due_after = _extract_query_param(request, "dueAfter", "due_after")
    planned_date = _extract_query_param(request, "plannedDate", "planned_date")

    has_due_str = _extract_query_param(request, "hasDueDate", "has_due_date")
    has_due_date = None
    if has_due_str is not None:
        has_due_date = has_due_str.lower() in ("true", "1", "yes")

    return svc.get_tasks(
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


@router.get("/api/projects/{project_id}/tasks/{task_id}", response_model=TaskResponse)
def get_single_task(project_id: str, task_id: str, svc: TaskApplicationService = Depends(get_task_service)):
    return svc.get_task(project_id, task_id)


@router.post("/api/projects/{project_id}/tasks", response_model=TaskResponse, status_code=201)
def create_new_task(project_id: str, req: TaskCreate, svc: TaskApplicationService = Depends(get_task_service)):
    return svc.create_task(project_id, req)


@router.patch("/api/projects/{project_id}/tasks/{task_id}", response_model=TaskResponse)
@router.put("/api/projects/{project_id}/tasks/{task_id}", response_model=TaskResponse)
def update_existing_task(
    project_id: str,
    task_id: str,
    req: TaskUpdate,
    svc: TaskApplicationService = Depends(get_task_service),
):
    return svc.update_task(project_id, task_id, req)


@router.patch("/api/projects/{project_id}/tasks/{task_id}/move", response_model=TaskResponse)
def move_existing_task(
    project_id: str,
    task_id: str,
    req: TaskMove,
    svc: TaskApplicationService = Depends(get_task_service),
):
    return svc.move_task(project_id, task_id, req)


@router.delete("/api/projects/{project_id}/tasks/{task_id}", status_code=204)
def delete_existing_task(project_id: str, task_id: str, svc: TaskApplicationService = Depends(get_task_service)):
    svc.delete_task(project_id, task_id)


# Attachments
@router.post("/api/projects/{project_id}/tasks/{task_id}/attachments", response_model=TaskResponse)
def upload_task_attachment(
    project_id: str,
    task_id: str,
    file: UploadFile = File(...),
    svc: TaskApplicationService = Depends(get_task_service),
):
    filename = file.filename or "attachment"
    content = file.file.read()
    return svc.add_attachment(project_id, task_id, filename, content)


@router.delete("/api/projects/{project_id}/tasks/{task_id}/attachments/{filename}", response_model=TaskResponse)
def delete_task_attachment(
    project_id: str,
    task_id: str,
    filename: str,
    svc: TaskApplicationService = Depends(get_task_service),
):
    return svc.remove_attachment(project_id, task_id, filename)


@router.get("/api/projects/{project_id}/tasks/{task_id}/attachments/{filename}")
def serve_task_attachment(
    project_id: str,
    task_id: str,
    filename: str,
    data_dir: str = Depends(get_data_dir),
):
    path = Path(data_dir) / project_id / "attachments" / task_id / filename
    if not path.is_file():
        raise HTTPException(status_code=404, detail="Attachment file not found")
    return FileResponse(path)
