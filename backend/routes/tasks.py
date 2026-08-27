from typing import List, Optional
from fastapi import APIRouter, File, HTTPException, Query, Request, UploadFile
from fastapi.responses import FileResponse
from backend.models.task import TaskCreate, TaskMove, TaskResponse, TaskUpdate
from backend.services.task_service import (
    create_task,
    delete_attachment,
    delete_task,
    get_attachment_path,
    get_tasks,
    move_task,
    read_task_file,
    save_attachment,
    update_task,
)

router = APIRouter(tags=["tasks"])


# Global tasks endpoint
@router.get("/api/tasks", response_model=List[TaskResponse])
def list_all_tasks(
    exclude_buckets: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
):
    ex_list = [b.strip() for b in exclude_buckets.split(",")] if exclude_buckets else None
    return get_tasks(
        exclude_buckets=ex_list,
        search=search,
    )


# Project-scoped tasks endpoints
@router.get("/api/projects/{project_id}/tasks", response_model=List[TaskResponse])
def list_project_tasks(
    project_id: str,
    bucket: Optional[str] = Query(None),
    buckets: Optional[str] = Query(None),
    tag: Optional[str] = Query(None),
    tags: Optional[str] = Query(None),
    tag_mode: str = Query("any"),
    exclude_bucket: Optional[str] = Query(None),
    exclude_buckets: Optional[str] = Query(None),
    priorities: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    due_before: Optional[str] = Query(None),
    due_after: Optional[str] = Query(None),
    planned_date: Optional[str] = Query(None),
    has_due_date: Optional[bool] = Query(None),
):
    b_list = [b.strip() for b in buckets.split(",")] if buckets else None
    t_list = [t.strip() for t in tags.split(",")] if tags else None
    ex_list = [b.strip() for b in exclude_buckets.split(",")] if exclude_buckets else None
    p_list = [p.strip() for p in priorities.split(",")] if priorities else None

    return get_tasks(
        project_id=project_id,
        bucket=bucket,
        buckets=b_list,
        tag=tag,
        tags=t_list,
        tag_mode=tag_mode,
        exclude_bucket=exclude_bucket,
        exclude_buckets=ex_list,
        priorities=p_list,
        search=search,
        due_before=due_before,
        due_after=due_after,
        planned_date=planned_date,
        has_due_date=has_due_date,
    )


@router.get("/api/projects/{project_id}/tasks/{task_id}", response_model=TaskResponse)
def get_single_task(project_id: str, task_id: str, request: Request):
    data_dir = request.app.state.config.data_dir
    try:
        return read_task_file(data_dir, task_id)
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/api/projects/{project_id}/tasks", response_model=TaskResponse, status_code=201)
def create_new_task(project_id: str, req: TaskCreate, request: Request):
    data_dir = request.app.state.config.data_dir
    try:
        return create_task(data_dir, project_id, req)
    except KeyError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/api/projects/{project_id}/tasks/{task_id}", response_model=TaskResponse)
def update_existing_task(project_id: str, task_id: str, req: TaskUpdate, request: Request):
    data_dir = request.app.state.config.data_dir
    try:
        return update_task(data_dir, project_id, task_id, req)
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/api/projects/{project_id}/tasks/{task_id}/move", response_model=TaskResponse)
def move_existing_task(project_id: str, task_id: str, req: TaskMove, request: Request):
    data_dir = request.app.state.config.data_dir
    try:
        return move_task(data_dir, project_id, task_id, req)
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/api/projects/{project_id}/tasks/{task_id}", status_code=204)
def delete_existing_task(project_id: str, task_id: str, request: Request):
    data_dir = request.app.state.config.data_dir
    delete_task(data_dir, project_id, task_id)


# Attachments
@router.post("/api/projects/{project_id}/tasks/{task_id}/attachments", response_model=TaskResponse)
def upload_task_attachment(
    project_id: str,
    task_id: str,
    file: UploadFile = File(...),
    request: Request = None,
):
    data_dir = request.app.state.config.data_dir
    filename = file.filename or "attachment"
    try:
        return save_attachment(data_dir, project_id, task_id, filename, file.file)
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/api/projects/{project_id}/tasks/{task_id}/attachments/{filename}", response_model=TaskResponse)
def delete_task_attachment(project_id: str, task_id: str, filename: str, request: Request):
    data_dir = request.app.state.config.data_dir
    try:
        return delete_attachment(data_dir, project_id, task_id, filename)
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/api/projects/{project_id}/tasks/{task_id}/attachments/{filename}")
def serve_task_attachment(project_id: str, task_id: str, filename: str, request: Request):
    data_dir = request.app.state.config.data_dir
    path = get_attachment_path(data_dir, project_id, task_id, filename)
    if not path.is_file():
        raise HTTPException(status_code=404, detail="Attachment file not found")
    return FileResponse(path)
