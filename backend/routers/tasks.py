from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import func

from database import db_session
from db_models import Bucket, Project, Task
from models import TaskCreate, TaskMove, TaskResponse, TaskUpdate
from storage import (
    delete_task_file,
    generate_next_id,
    read_task_file,
    write_task_file,
)

router = APIRouter(prefix="/projects/{project_id}/tasks", tags=["Tasks"])


@router.get("", response_model=List[TaskResponse])
def get_tasks(
    project_id: str,
    bucket: Optional[str] = Query(None, description="Filter by bucket (column) name"),
    tag: Optional[str] = Query(None, description="Filter by tag name"),
    exclude_bucket: Optional[str] = Query(None, description="Exclude tasks from this bucket name"),
):
    with db_session() as session:
        # Verify project exists
        project = session.query(Project).filter(Project.id == project_id).first()
        if not project:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Project '{project_id}' not found.",
            )

        query = session.query(Task).filter(Task.project_id == project_id)

        if bucket:
            query = query.filter(Task.bucket == bucket)
        elif exclude_bucket:
            query = query.filter(Task.bucket != exclude_bucket)

        query = query.order_by(Task.position.asc())
        tasks = query.all()

        if tag:
            # Filter by tag case-insensitively in Python for full compatibility
            tasks = [t for t in tasks if any(tg.lower() == tag.lower() for tg in t.tags)]

        return [
            TaskResponse(
                id=t.id,
                project_id=t.project_id,
                title=t.title,
                bucket=t.bucket,
                position=t.position,
                tags=t.tags,
                body=t.body,
                due_date=t.due_date,
                priority=t.priority,
                color=t.color,
                created_at=t.created_at,
                updated_at=t.updated_at,
            )
            for t in tasks
        ]


@router.get("/{task_id}", response_model=TaskResponse)
def get_task(project_id: str, task_id: int):
    task_data = read_task_file(task_id)
    if not task_data or task_data["project_id"] != project_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Task with ID {task_id} not found in project '{project_id}'",
        )
    return TaskResponse(**task_data)


@router.post("", response_model=TaskResponse, status_code=status.HTTP_201_CREATED)
def create_task(project_id: str, task: TaskCreate):
    with db_session() as session:
        # Verify project exists
        project = session.query(Project).filter(Project.id == project_id).first()
        if not project:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Project '{project_id}' not found.",
            )

        # Verify bucket exists for this project
        db_bucket = session.query(Bucket).filter(Bucket.project_id == project_id, Bucket.name == task.bucket).first()
        if not db_bucket:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Bucket '{task.bucket}' does not exist in project '{project_id}'.",
            )

        now_str = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
        new_id = generate_next_id()

        # Calculate position: min position in current bucket - 1000.0 (or default to 1000.0)
        min_pos = session.query(func.min(Task.position)).filter(Task.project_id == project_id, Task.bucket == task.bucket).scalar()
        new_position = 1000.0 if min_pos is None else float(min_pos) - 1000.0

        task_tags = [t.lower() for t in task.tags]
        task_data = {
            "id": new_id,
            "project_id": project_id,
            "title": task.title,
            "bucket": task.bucket,
            "position": new_position,
            "tags": task_tags,
            "body": task.body,
            "due_date": task.due_date,
            "priority": task.priority,
            "color": task.color,
            "created_at": now_str,
            "updated_at": now_str,
        }

        # Write to Markdown file
        filename = write_task_file(new_id, task_data)

        # Insert into SQLite index
        db_task = Task(
            id=new_id,
            project_id=project_id,
            title=task.title,
            bucket=task.bucket,
            position=new_position,
            tags=task_tags,
            filename=filename,
            due_date=task.due_date,
            priority=task.priority,
            color=task.color,
            created_at=now_str,
            updated_at=now_str,
        )
        session.add(db_task)
        session.flush()

        return TaskResponse(**task_data)


@router.put("/{task_id}", response_model=TaskResponse)
def update_task(project_id: str, task_id: int, task_update: TaskUpdate):
    # Fetch existing task from Markdown
    existing = read_task_file(task_id)
    if not existing or existing["project_id"] != project_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Task with ID {task_id} not found in project '{project_id}'",
        )

    now_str = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")

    # Merge updates
    updated_title = task_update.title if task_update.title is not None else existing["title"]
    updated_bucket = task_update.bucket if task_update.bucket is not None else existing["bucket"]
    updated_position = task_update.position if task_update.position is not None else existing["position"]
    updated_tags = [t.lower() for t in task_update.tags] if task_update.tags is not None else [t.lower() for t in existing["tags"]]
    updated_body = task_update.body if task_update.body is not None else existing["body"]
    # due_date and priority support explicit null to clear the field
    updated_due_date = task_update.due_date if "due_date" in task_update.model_fields_set else existing.get("due_date")
    updated_priority = task_update.priority if "priority" in task_update.model_fields_set else existing.get("priority")
    updated_color = task_update.color if "color" in task_update.model_fields_set else existing.get("color")

    updated_data = {
        "id": task_id,
        "project_id": project_id,
        "title": updated_title,
        "bucket": updated_bucket,
        "position": updated_position,
        "tags": updated_tags,
        "body": updated_body,
        "due_date": updated_due_date,
        "priority": updated_priority,
        "color": updated_color,
        "created_at": existing["created_at"],
        "updated_at": now_str,
    }

    with db_session() as session:
        # Verify new bucket exists if changed
        if task_update.bucket is not None:
            bucket_exists = session.query(Bucket).filter(Bucket.project_id == project_id, Bucket.name == updated_bucket).first()
            if not bucket_exists:
                if updated_bucket == "done":
                    max_pos = session.query(func.max(Bucket.position)).filter(Bucket.project_id == project_id).scalar()
                    new_position = 1000.0 if max_pos is None else float(max_pos) + 1000.0

                    db_bucket = Bucket(
                        project_id=project_id,
                        name="done",
                        title="Done",
                        subtitle="",
                        position=new_position,
                    )
                    session.add(db_bucket)
                    session.flush()

                    all_buckets = session.query(Bucket).filter(Bucket.project_id == project_id).order_by(Bucket.position.asc()).all()
                    from storage import write_buckets_file

                    all_buckets_dict = []
                    for b in all_buckets:
                        all_buckets_dict.append(
                            {
                                "name": b.name,
                                "title": b.title,
                                "subtitle": b.subtitle,
                                "position": b.position,
                                "color": b.color,
                                "layout": b.layout,
                                "max_tasks": b.max_tasks,
                                "is_default": b.is_default,
                            }
                        )
                    write_buckets_file(project_id, all_buckets_dict)
                else:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Bucket '{updated_bucket}' does not exist in project '{project_id}'.",
                    )

        # Write to Markdown file
        new_filename = write_task_file(task_id, updated_data)

        # Update SQLite index
        db_task = session.query(Task).filter(Task.id == task_id, Task.project_id == project_id).first()
        if db_task:
            db_task.title = updated_title
            db_task.bucket = updated_bucket
            db_task.position = updated_position
            db_task.tags = updated_tags
            db_task.filename = new_filename
            db_task.due_date = updated_due_date
            db_task.priority = updated_priority
            db_task.color = updated_color
            db_task.updated_at = now_str
            session.flush()

    return TaskResponse(**updated_data)


@router.patch("/{task_id}/move", response_model=TaskResponse)
def move_task(project_id: str, task_id: int, task_move: TaskMove):
    # Fetch existing task from Markdown
    existing = read_task_file(task_id)
    if not existing or existing["project_id"] != project_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Task with ID {task_id} not found in project '{project_id}'",
        )

    now_str = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")

    updated_data = {
        **existing,
        "bucket": task_move.bucket,
        "position": task_move.position,
        "updated_at": now_str,
    }

    with db_session() as session:
        # Verify target bucket exists for this project
        bucket_exists = session.query(Bucket).filter(Bucket.project_id == project_id, Bucket.name == task_move.bucket).first()
        if not bucket_exists:
            if task_move.bucket == "done":
                max_pos = session.query(func.max(Bucket.position)).filter(Bucket.project_id == project_id).scalar()
                new_position = 1000.0 if max_pos is None else float(max_pos) + 1000.0

                db_bucket = Bucket(
                    project_id=project_id,
                    name="done",
                    title="Done",
                    subtitle="",
                    position=new_position,
                )
                session.add(db_bucket)
                session.flush()

                all_buckets = session.query(Bucket).filter(Bucket.project_id == project_id).order_by(Bucket.position.asc()).all()
                from storage import write_buckets_file

                all_buckets_dict = []
                for b in all_buckets:
                    all_buckets_dict.append(
                        {
                            "name": b.name,
                            "title": b.title,
                            "subtitle": b.subtitle,
                            "position": b.position,
                            "color": b.color,
                            "layout": b.layout,
                            "max_tasks": b.max_tasks,
                            "is_default": b.is_default,
                        }
                    )
                write_buckets_file(project_id, all_buckets_dict)
            else:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Bucket '{task_move.bucket}' does not exist in project '{project_id}'.",
                )

        # Write to Markdown file
        new_filename = write_task_file(task_id, updated_data)

        # Update SQLite index
        db_task = session.query(Task).filter(Task.id == task_id, Task.project_id == project_id).first()
        if db_task:
            db_task.bucket = task_move.bucket
            db_task.position = task_move.position
            db_task.filename = new_filename
            db_task.updated_at = now_str
            session.flush()

    return TaskResponse(**updated_data)


@router.delete("/{task_id}")
def delete_task(project_id: str, task_id: int):
    # Verify task exists in the project
    existing = read_task_file(task_id)
    if not existing or existing["project_id"] != project_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Task with ID {task_id} not found in project '{project_id}'",
        )

    # Delete from filesystem
    delete_task_file(task_id)

    # Delete from SQLite
    with db_session() as session:
        db_task = session.query(Task).filter(Task.id == task_id, Task.project_id == project_id).first()
        if db_task:
            session.delete(db_task)
            session.flush()

    return {"status": "success", "detail": f"Task {task_id} deleted"}
