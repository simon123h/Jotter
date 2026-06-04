from typing import List

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import func

from database import db_session
from db_models import Bucket, Project
from models import BucketCreate, BucketResponse, BucketUpdate
from storage import slugify, write_buckets_file

router = APIRouter(prefix="/projects/{project_id}/buckets", tags=["Buckets"])


@router.get("", response_model=List[BucketResponse])
def get_buckets(project_id: str):
    with db_session() as session:
        # Verify project exists
        project = session.query(Project).filter(Project.id == project_id).first()
        if not project:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Project '{project_id}' not found.",
            )

        buckets = session.query(Bucket).filter(Bucket.project_id == project_id).order_by(Bucket.position.asc()).all()
        return buckets


@router.post("", response_model=BucketResponse, status_code=status.HTTP_201_CREATED)
def create_bucket(project_id: str, bucket: BucketCreate):
    name = slugify(bucket.title)
    if not name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid title. Could not generate a bucket name slug.",
        )

    with db_session() as session:
        # Verify project exists
        project = session.query(Project).filter(Project.id == project_id).first()
        if not project:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Project '{project_id}' not found.",
            )

        # Check if bucket name already exists in this project
        existing = session.query(Bucket).filter(Bucket.project_id == project_id, Bucket.name == name).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"A column with a similar name '{name}' already exists in project '{project_id}'.",
            )

        # Calculate position: max position + 1000.0
        max_pos = session.query(func.max(Bucket.position)).filter(Bucket.project_id == project_id).scalar()
        new_position = 1000.0 if max_pos is None else float(max_pos) + 1000.0

        if bucket.is_default:
            session.query(Bucket).filter(Bucket.project_id == project_id).update({Bucket.is_default: False})

        db_bucket = Bucket(
            project_id=project_id,
            name=name,
            title=bucket.title,
            subtitle=bucket.subtitle or "",
            position=new_position,
            color=bucket.color,
            layout=bucket.layout or "list",
            max_tasks=bucket.max_tasks,
            is_default=bool(bucket.is_default),
        )
        session.add(db_bucket)
        session.flush()

        # Sync to project's buckets.json file
        all_buckets = session.query(Bucket).filter(Bucket.project_id == project_id).order_by(Bucket.position.asc()).all()
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

        return db_bucket


@router.put("/{name}", response_model=BucketResponse)
def update_bucket(project_id: str, name: str, bucket_update: BucketUpdate):
    with db_session() as session:
        # Verify project exists
        project = session.query(Project).filter(Project.id == project_id).first()
        if not project:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Project '{project_id}' not found.",
            )

        # Check if bucket exists in this project
        existing = session.query(Bucket).filter(Bucket.project_id == project_id, Bucket.name == name).first()
        if not existing:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Column '{name}' not found in project '{project_id}'.",
            )

        # Update properties if set
        if bucket_update.title is not None:
            existing.title = bucket_update.title
        if bucket_update.subtitle is not None:
            existing.subtitle = bucket_update.subtitle
        if bucket_update.position is not None:
            existing.position = bucket_update.position
        if "color" in bucket_update.model_fields_set:
            existing.color = bucket_update.color
        if bucket_update.layout is not None:
            existing.layout = bucket_update.layout
        if "max_tasks" in bucket_update.model_fields_set:
            existing.max_tasks = bucket_update.max_tasks
        if bucket_update.is_default is not None:
            if bucket_update.is_default:
                session.query(Bucket).filter(Bucket.project_id == project_id).update({Bucket.is_default: False})
            existing.is_default = bucket_update.is_default

        session.flush()

        # Sync to project's buckets.json file
        all_buckets = session.query(Bucket).filter(Bucket.project_id == project_id).order_by(Bucket.position.asc()).all()
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

        return existing


@router.delete("/{name}")
def delete_bucket(project_id: str, name: str):
    with db_session() as session:
        # Verify project exists
        project = session.query(Project).filter(Project.id == project_id).first()
        if not project:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Project '{project_id}' not found.",
            )

        # Check if bucket exists in this project
        existing = session.query(Bucket).filter(Bucket.project_id == project_id, Bucket.name == name).first()
        if not existing:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Column '{name}' not found in project '{project_id}'.",
            )

        # Check if there are tasks in this bucket in this project
        from db_models import Task

        task_count = session.query(Task).filter(Task.project_id == project_id, Task.bucket == name).count()
        if task_count > 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    f"Cannot delete column '{name}' because it contains {task_count} task(s). Please move or delete these tasks first."
                ),
            )

        session.delete(existing)
        session.flush()

        # Sync to project's buckets.json file
        all_buckets = session.query(Bucket).filter(Bucket.project_id == project_id).order_by(Bucket.position.asc()).all()
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

        return {"status": "success", "detail": f"Column '{name}' deleted"}
