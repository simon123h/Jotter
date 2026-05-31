from typing import List

from fastapi import APIRouter, HTTPException, status

from database import db_session
from models import BucketCreate, BucketResponse, BucketUpdate
from storage import slugify, write_buckets_file

router = APIRouter(prefix="/buckets", tags=["Buckets"])


@router.get("", response_model=List[BucketResponse])
def get_buckets():
    with db_session() as conn:
        cursor = conn.execute("SELECT name, title, position FROM buckets ORDER BY position ASC")
        rows = cursor.fetchall()
        return [dict(row) for row in rows]


@router.post("", response_model=BucketResponse, status_code=status.HTTP_201_CREATED)
def create_bucket(bucket: BucketCreate):
    name = slugify(bucket.title)
    if not name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid title. Could not generate a bucket name slug.",
        )

    with db_session() as conn:
        # Check if bucket name already exists
        cursor = conn.execute("SELECT 1 FROM buckets WHERE name = ?", (name,))
        if cursor.fetchone():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"A column with a similar name '{name}' already exists.",
            )

        # Calculate position: max position + 1000.0
        cursor = conn.execute("SELECT MAX(position) as max_pos FROM buckets")
        row = cursor.fetchone()
        new_position = 1000.0
        if row and row["max_pos"] is not None:
            new_position = float(row["max_pos"]) + 1000.0

        conn.execute(
            "INSERT INTO buckets (name, title, position) VALUES (?, ?, ?)",
            (name, bucket.title, new_position),
        )

        # Sync to buckets.json file
        cursor = conn.execute("SELECT name, title, position FROM buckets ORDER BY position ASC")
        all_buckets = [dict(r) for r in cursor.fetchall()]
        write_buckets_file(all_buckets)

        return BucketResponse(name=name, title=bucket.title, position=new_position)


@router.put("/{name}", response_model=BucketResponse)
def update_bucket(name: str, bucket_update: BucketUpdate):
    with db_session() as conn:
        # Check if bucket exists
        cursor = conn.execute("SELECT name, title, position FROM buckets WHERE name = ?", (name,))
        existing = cursor.fetchone()
        if not existing:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Column '{name}' not found.",
            )

        updated_title = bucket_update.title if bucket_update.title is not None else existing["title"]
        updated_position = bucket_update.position if bucket_update.position is not None else existing["position"]

        conn.execute(
            "UPDATE buckets SET title = ?, position = ? WHERE name = ?",
            (updated_title, updated_position, name),
        )

        # Sync to buckets.json file
        cursor = conn.execute("SELECT name, title, position FROM buckets ORDER BY position ASC")
        all_buckets = [dict(r) for r in cursor.fetchall()]
        write_buckets_file(all_buckets)

        return BucketResponse(name=name, title=updated_title, position=updated_position)


@router.delete("/{name}")
def delete_bucket(name: str):
    with db_session() as conn:
        # Check if bucket exists
        cursor = conn.execute("SELECT 1 FROM buckets WHERE name = ?", (name,))
        if not cursor.fetchone():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Column '{name}' not found.",
            )

        # Check if there are tasks in this bucket
        cursor = conn.execute("SELECT COUNT(*) as count FROM tasks WHERE bucket = ?", (name,))
        row = cursor.fetchone()
        if row and row["count"] > 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    f"Cannot delete column '{name}' because it contains {row['count']} task(s). Please move or delete these tasks first."
                ),
            )

        conn.execute("DELETE FROM buckets WHERE name = ?", (name,))

        # Sync to buckets.json file
        cursor = conn.execute("SELECT name, title, position FROM buckets ORDER BY position ASC")
        all_buckets = [dict(r) for r in cursor.fetchall()]
        write_buckets_file(all_buckets)

        return {"status": "success", "detail": f"Column '{name}' deleted"}
