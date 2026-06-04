from typing import List

from fastapi import APIRouter, HTTPException, status

from database import db_session
from models import BucketCreate, BucketResponse, BucketUpdate
from storage import slugify, write_buckets_file

router = APIRouter(prefix="/projects/{project_id}/buckets", tags=["Buckets"])


@router.get("", response_model=List[BucketResponse])
def get_buckets(project_id: str):
    with db_session() as conn:
        # Verify project exists
        cursor = conn.execute("SELECT 1 FROM projects WHERE id = ?", (project_id,))
        if not cursor.fetchone():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Project '{project_id}' not found.",
            )

        cursor = conn.execute(
            "SELECT name, title, subtitle, position, color, layout FROM buckets WHERE project_id = ? ORDER BY position ASC",
            (project_id,),
        )
        rows = cursor.fetchall()
        return [dict(row) for row in rows]


@router.post("", response_model=BucketResponse, status_code=status.HTTP_201_CREATED)
def create_bucket(project_id: str, bucket: BucketCreate):
    name = slugify(bucket.title)
    if not name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid title. Could not generate a bucket name slug.",
        )

    with db_session() as conn:
        # Verify project exists
        cursor = conn.execute("SELECT 1 FROM projects WHERE id = ?", (project_id,))
        if not cursor.fetchone():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Project '{project_id}' not found.",
            )

        # Check if bucket name already exists in this project
        cursor = conn.execute(
            "SELECT 1 FROM buckets WHERE project_id = ? AND name = ?",
            (project_id, name),
        )
        if cursor.fetchone():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"A column with a similar name '{name}' already exists in project '{project_id}'.",
            )

        # Calculate position: max position + 1000.0
        cursor = conn.execute("SELECT MAX(position) as max_pos FROM buckets WHERE project_id = ?", (project_id,))
        row = cursor.fetchone()
        new_position = 1000.0
        if row and row["max_pos"] is not None:
            new_position = float(row["max_pos"]) + 1000.0

        conn.execute(
            "INSERT INTO buckets (project_id, name, title, subtitle, position, color, layout) VALUES (?, ?, ?, ?, ?, ?, ?)",
            (project_id, name, bucket.title, bucket.subtitle or "", new_position, bucket.color, bucket.layout or "list"),
        )

        # Sync to project's buckets.json file
        cursor = conn.execute(
            "SELECT name, title, subtitle, position, color, layout FROM buckets WHERE project_id = ? ORDER BY position ASC",
            (project_id,),
        )
        all_buckets = [dict(r) for r in cursor.fetchall()]
        write_buckets_file(project_id, all_buckets)

        return BucketResponse(
            name=name,
            title=bucket.title,
            subtitle=bucket.subtitle or "",
            position=new_position,
            color=bucket.color,
            layout=bucket.layout or "list",
        )


@router.put("/{name}", response_model=BucketResponse)
def update_bucket(project_id: str, name: str, bucket_update: BucketUpdate):
    with db_session() as conn:
        # Verify project exists
        cursor = conn.execute("SELECT 1 FROM projects WHERE id = ?", (project_id,))
        if not cursor.fetchone():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Project '{project_id}' not found.",
            )

        # Check if bucket exists in this project
        cursor = conn.execute(
            "SELECT name, title, subtitle, position, color, layout FROM buckets WHERE project_id = ? AND name = ?",
            (project_id, name),
        )
        existing = cursor.fetchone()
        if not existing:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Column '{name}' not found in project '{project_id}'.",
            )

        updated_title = bucket_update.title if bucket_update.title is not None else existing["title"]
        updated_subtitle = bucket_update.subtitle if bucket_update.subtitle is not None else existing["subtitle"]
        updated_position = bucket_update.position if bucket_update.position is not None else existing["position"]
        updated_color = bucket_update.color if "color" in bucket_update.model_fields_set else existing["color"]
        updated_layout = bucket_update.layout if bucket_update.layout is not None else existing["layout"]

        conn.execute(
            "UPDATE buckets SET title = ?, subtitle = ?, position = ?, color = ?, layout = ? WHERE project_id = ? AND name = ?",
            (updated_title, updated_subtitle, updated_position, updated_color, updated_layout, project_id, name),
        )

        # Sync to project's buckets.json file
        cursor = conn.execute(
            "SELECT name, title, subtitle, position, color, layout FROM buckets WHERE project_id = ? ORDER BY position ASC",
            (project_id,),
        )
        all_buckets = [dict(r) for r in cursor.fetchall()]
        write_buckets_file(project_id, all_buckets)

        return BucketResponse(
            name=name, title=updated_title, subtitle=updated_subtitle, position=updated_position, color=updated_color, layout=updated_layout
        )


@router.delete("/{name}")
def delete_bucket(project_id: str, name: str):
    with db_session() as conn:
        # Verify project exists
        cursor = conn.execute("SELECT 1 FROM projects WHERE id = ?", (project_id,))
        if not cursor.fetchone():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Project '{project_id}' not found.",
            )

        # Check if bucket exists in this project
        cursor = conn.execute(
            "SELECT 1 FROM buckets WHERE project_id = ? AND name = ?",
            (project_id, name),
        )
        if not cursor.fetchone():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Column '{name}' not found in project '{project_id}'.",
            )

        # Check if there are tasks in this bucket in this project
        cursor = conn.execute(
            "SELECT COUNT(*) as count FROM tasks WHERE project_id = ? AND bucket = ?",
            (project_id, name),
        )
        row = cursor.fetchone()
        if row and row["count"] > 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    f"Cannot delete column '{name}' because it contains {row['count']} task(s). Please move or delete these tasks first."
                ),
            )

        conn.execute("DELETE FROM buckets WHERE project_id = ? AND name = ?", (project_id, name))

        # Sync to project's buckets.json file
        cursor = conn.execute(
            "SELECT name, title, subtitle, position, color, layout FROM buckets WHERE project_id = ? ORDER BY position ASC",
            (project_id,),
        )
        all_buckets = [dict(r) for r in cursor.fetchall()]
        write_buckets_file(project_id, all_buckets)

        return {"status": "success", "detail": f"Column '{name}' deleted"}
