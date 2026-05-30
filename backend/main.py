import json
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import FastAPI, HTTPException, Query, status
from fastapi.middleware.cors import CORSMiddleware

from contextlib import asynccontextmanager

from database import init_db, db_session
from models import TaskCreate, TaskUpdate, TaskMove, TaskResponse
from storage import (
    read_task_file,
    write_task_file,
    delete_task_file,
    sync_db_with_files,
    generate_next_id
)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize SQLite database and populate from Markdown files if DB is empty
    init_db()
    
    # Sync database with existing markdown files automatically on startup
    sync_db_with_files()
    yield

app = FastAPI(title="Local-First Markdown Kanban App API", lifespan=lifespan)

# Enable CORS for frontend integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all for local dev
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/tasks", response_model=List[TaskResponse])
def get_tasks(
    bucket: Optional[str] = Query(None, description="Filter by bucket"),
    tag: Optional[str] = Query(None, description="Filter by tag")
):
    with db_session() as conn:
        query = "SELECT * FROM tasks"
        params = []
        conditions = []
        
        if bucket:
            conditions.append("bucket = ?")
            params.append(bucket)
            
        if conditions:
            query += " WHERE " + " AND ".join(conditions)
            
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
                
            tasks.append(TaskResponse(
                id=row["id"],
                title=row["title"],
                bucket=row["bucket"],
                position=row["position"],
                tags=row_tags,
                body="",  # Do not return full body in listing for efficiency
                created_at=row["created_at"],
                updated_at=row["updated_at"]
            ))
            
        return tasks

@app.get("/tasks/{task_id}", response_model=TaskResponse)
def get_task(task_id: int):
    task_data = read_task_file(task_id)
    if not task_data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Task with ID {task_id} not found on disk"
        )
    return TaskResponse(**task_data)

@app.post("/tasks", response_model=TaskResponse, status_code=status.HTTP_201_CREATED)
def create_task(task: TaskCreate):
    now_str = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    new_id = generate_next_id()
    
    # Calculate position: max position in current bucket + 1000.0 (or default to 1000.0)
    with db_session() as conn:
        cursor = conn.execute(
            "SELECT MAX(position) as max_pos FROM tasks WHERE bucket = ?", 
            (task.bucket,)
        )
        row = cursor.fetchone()
        new_position = 1000.0
        if row and row["max_pos"] is not None:
            new_position = float(row["max_pos"]) + 1000.0
            
        task_data = {
            "id": new_id,
            "title": task.title,
            "bucket": task.bucket,
            "position": new_position,
            "tags": task.tags,
            "body": task.body,
            "created_at": now_str,
            "updated_at": now_str
        }
        
        # Write to Markdown file
        filename = write_task_file(new_id, task_data)
        
        # Insert into SQLite index
        conn.execute("""
            INSERT INTO tasks (id, title, bucket, position, tags, filename, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            new_id,
            task.title,
            task.bucket,
            new_position,
            json.dumps(task.tags),
            filename,
            now_str,
            now_str
        ))
        
        return TaskResponse(**task_data)

@app.put("/tasks/{task_id}", response_model=TaskResponse)
def update_task(task_id: int, task_update: TaskUpdate):
    # Fetch existing task from Markdown
    existing = read_task_file(task_id)
    if not existing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Task with ID {task_id} not found"
        )
        
    now_str = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    
    # Merge updates
    updated_title = task_update.title if task_update.title is not None else existing["title"]
    updated_bucket = task_update.bucket if task_update.bucket is not None else existing["bucket"]
    updated_position = task_update.position if task_update.position is not None else existing["position"]
    updated_tags = task_update.tags if task_update.tags is not None else existing["tags"]
    updated_body = task_update.body if task_update.body is not None else existing["body"]
    
    updated_data = {
        "id": task_id,
        "title": updated_title,
        "bucket": updated_bucket,
        "position": updated_position,
        "tags": updated_tags,
        "body": updated_body,
        "created_at": existing["created_at"],
        "updated_at": now_str
    }
    
    # Write to Markdown file (handles slug/filename changes internally)
    new_filename = write_task_file(task_id, updated_data)
    
    # Update SQLite index
    with db_session() as conn:
        conn.execute("""
            UPDATE tasks
            SET title = ?, bucket = ?, position = ?, tags = ?, filename = ?, updated_at = ?
            WHERE id = ?
        """, (
            updated_title,
            updated_bucket,
            updated_position,
            json.dumps(updated_tags),
            new_filename,
            now_str,
            task_id
        ))
        
    return TaskResponse(**updated_data)

@app.patch("/tasks/{task_id}/move", response_model=TaskResponse)
def move_task(task_id: int, task_move: TaskMove):
    # Fetch existing task from Markdown
    existing = read_task_file(task_id)
    if not existing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Task with ID {task_id} not found"
        )
        
    now_str = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    
    updated_data = {
        **existing,
        "bucket": task_move.bucket,
        "position": task_move.position,
        "updated_at": now_str
    }
    
    # Write to Markdown file
    new_filename = write_task_file(task_id, updated_data)
    
    # Update SQLite index
    with db_session() as conn:
        conn.execute("""
            UPDATE tasks
            SET bucket = ?, position = ?, filename = ?, updated_at = ?
            WHERE id = ?
        """, (
            task_move.bucket,
            task_move.position,
            new_filename,
            now_str,
            task_id
        ))
        
    return TaskResponse(**updated_data)

@app.delete("/tasks/{task_id}")
def delete_task(task_id: int):
    # Delete from filesystem
    deleted = delete_task_file(task_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Task with ID {task_id} not found on disk"
        )
        
    # Delete from SQLite
    with db_session() as conn:
        conn.execute("DELETE FROM tasks WHERE id = ?", (task_id,))
        
    return {"status": "success", "detail": f"Task {task_id} deleted"}

@app.post("/system/sync")
def sync_system():
    try:
        count = sync_db_with_files()
        return {"status": "success", "synchronized_tasks": count}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Synchronization failed: {str(e)}"
        )
