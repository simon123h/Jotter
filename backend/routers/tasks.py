import json
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, HTTPException, Query, status

from database import db_session
from models import TaskCreate, TaskMove, TaskResponse, TaskUpdate
from storage import delete_task_file, generate_next_id, read_task_file, write_task_file

router = APIRouter(prefix="/projects/{project_id}/tasks", tags=["Tasks"])


@router.get("", response_model=List[TaskResponse])
def get_tasks(
    project_id: str,
    bucket: Optional[str] = Query(None, description="Filter by bucket (column) name"),
    tag: Optional[str] = Query(None, description="Filter by tag name"),
):
    with db_session() as conn:
        # Verify project exists
        cursor = conn.execute("SELECT 1 FROM projects WHERE id = ?", (project_id,))
        if not cursor.fetchone():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Project '{project_id}' not found.",
            )

        query = "SELECT * FROM tasks WHERE project_id = ?"
        params = [project_id]

        if bucket:
            query += " AND bucket = ?"
            params.append(bucket)

        # Order by position ascending
        query += " ORDER BY position ASC"

        cursor = conn.execute(query, params)
        rows = cursor.fetchall()

        tasks = []
        for row in rows:
            try:
                row_tags = json.loads(row["tags"])
            except Exception:
                row_tags = []

            # Skip if filtering by tag and tag not in list (done in Python for max compatibility)
            if tag and tag not in row_tags:
                continue

            tasks.append(
                TaskResponse(
                    id=row["id"],
                    project_id=row["project_id"],
                    title=row["title"],
                    bucket=row["bucket"],
                    position=row["position"],
                    tags=row_tags,
                    body="",  # Do not return full body in listing for efficiency
                    due_date=row["due_date"],
                    priority=row["priority"],
                    created_at=row["created_at"],
                    updated_at=row["updated_at"],
                )
            )

        return tasks


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
    with db_session() as conn:
        # Verify project exists
        cursor = conn.execute("SELECT 1 FROM projects WHERE id = ?", (project_id,))
        if not cursor.fetchone():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Project '{project_id}' not found.",
            )

        # Verify bucket exists for this project
        cursor = conn.execute(
            "SELECT 1 FROM buckets WHERE project_id = ? AND name = ?",
            (project_id, task.bucket),
        )
        if not cursor.fetchone():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Bucket '{task.bucket}' does not exist in project '{project_id}'.",
            )

        now_str = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
        new_id = generate_next_id()

        # Calculate position: max position in current bucket + 1000.0 (or default to 1000.0)
        cursor = conn.execute(
            "SELECT MAX(position) as max_pos FROM tasks WHERE project_id = ? AND bucket = ?",
            (project_id, task.bucket),
        )
        row = cursor.fetchone()
        new_position = 1000.0
        if row and row["max_pos"] is not None:
            new_position = float(row["max_pos"]) + 1000.0

        task_data = {
            "id": new_id,
            "project_id": project_id,
            "title": task.title,
            "bucket": task.bucket,
            "position": new_position,
            "tags": task.tags,
            "body": task.body,
            "due_date": task.due_date,
            "priority": task.priority,
            "created_at": now_str,
            "updated_at": now_str,
        }

        # Write to Markdown file
        filename = write_task_file(new_id, task_data)

        # Insert into SQLite index
        conn.execute(
            """
            INSERT INTO tasks (id, project_id, title, bucket, position, tags, filename, due_date, priority, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
            (
                new_id,
                project_id,
                task.title,
                task.bucket,
                new_position,
                json.dumps(task.tags),
                filename,
                task.due_date,
                task.priority,
                now_str,
                now_str,
            ),
        )

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
    updated_tags = task_update.tags if task_update.tags is not None else existing["tags"]
    updated_body = task_update.body if task_update.body is not None else existing["body"]
    # due_date and priority support explicit null to clear the field
    updated_due_date = task_update.due_date if "due_date" in task_update.model_fields_set else existing.get("due_date")
    updated_priority = task_update.priority if "priority" in task_update.model_fields_set else existing.get("priority")

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
        "created_at": existing["created_at"],
        "updated_at": now_str,
    }

    with db_session() as conn:
        # Verify new bucket exists if changed
        if task_update.bucket is not None:
            cursor = conn.execute(
                "SELECT 1 FROM buckets WHERE project_id = ? AND name = ?",
                (project_id, updated_bucket),
            )
            if not cursor.fetchone():
                if updated_bucket == "done":
                    cursor_pos = conn.execute("SELECT MAX(position) as max_pos FROM buckets WHERE project_id = ?", (project_id,))
                    row_pos = cursor_pos.fetchone()
                    new_position = 1000.0
                    if row_pos and row_pos["max_pos"] is not None:
                        new_position = float(row_pos["max_pos"]) + 1000.0

                    conn.execute(
                        "INSERT INTO buckets (project_id, name, title, subtitle, position) VALUES (?, ?, ?, ?, ?)",
                        (project_id, "done", "Done", "", new_position),
                    )

                    cursor_sync = conn.execute(
                        "SELECT name, title, subtitle, position FROM buckets WHERE project_id = ? ORDER BY position ASC",
                        (project_id,),
                    )
                    from storage import write_buckets_file
                    all_buckets = [dict(r) for r in cursor_sync.fetchall()]
                    write_buckets_file(project_id, all_buckets)
                else:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Bucket '{updated_bucket}' does not exist in project '{project_id}'.",
                    )

        # Write to Markdown file
        new_filename = write_task_file(task_id, updated_data)

        # Update SQLite index
        conn.execute(
            """
            UPDATE tasks
            SET title = ?, bucket = ?, position = ?, tags = ?, filename = ?, due_date = ?, priority = ?, updated_at = ?
            WHERE id = ? AND project_id = ?
        """,
            (
                updated_title,
                updated_bucket,
                updated_position,
                json.dumps(updated_tags),
                new_filename,
                updated_due_date,
                updated_priority,
                now_str,
                task_id,
                project_id,
            ),
        )

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

    with db_session() as conn:
        # Verify target bucket exists for this project
        cursor = conn.execute(
            "SELECT 1 FROM buckets WHERE project_id = ? AND name = ?",
            (project_id, task_move.bucket),
        )
        if not cursor.fetchone():
            if task_move.bucket == "done":
                cursor_pos = conn.execute("SELECT MAX(position) as max_pos FROM buckets WHERE project_id = ?", (project_id,))
                row_pos = cursor_pos.fetchone()
                new_position = 1000.0
                if row_pos and row_pos["max_pos"] is not None:
                    new_position = float(row_pos["max_pos"]) + 1000.0

                conn.execute(
                    "INSERT INTO buckets (project_id, name, title, subtitle, position) VALUES (?, ?, ?, ?, ?)",
                    (project_id, "done", "Done", "", new_position),
                )

                cursor_sync = conn.execute(
                    "SELECT name, title, subtitle, position FROM buckets WHERE project_id = ? ORDER BY position ASC",
                    (project_id,),
                )
                from storage import write_buckets_file
                all_buckets = [dict(r) for r in cursor_sync.fetchall()]
                write_buckets_file(project_id, all_buckets)
            else:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Bucket '{task_move.bucket}' does not exist in project '{project_id}'.",
                )

        # Write to Markdown file
        new_filename = write_task_file(task_id, updated_data)

        # Update SQLite index
        conn.execute(
            """
            UPDATE tasks
            SET bucket = ?, position = ?, filename = ?, updated_at = ?
            WHERE id = ? AND project_id = ?
        """,
            (task_move.bucket, task_move.position, new_filename, now_str, task_id, project_id),
        )

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
    with db_session() as conn:
        conn.execute("DELETE FROM tasks WHERE id = ? AND project_id = ?", (task_id, project_id))

    return {"status": "success", "detail": f"Task {task_id} deleted"}
