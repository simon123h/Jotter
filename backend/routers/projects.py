from datetime import datetime, timezone
from typing import List

from fastapi import APIRouter, HTTPException, status

from database import db_session
from db_models import Bucket, Project
from models import ProjectCreate, ProjectResponse, ProjectUpdate
from storage import (
    DEFAULT_BUCKETS,
    delete_project_dir,
    load_projects_file,
    slugify,
    write_buckets_file,
    write_projects_file,
)

router = APIRouter(prefix="/projects", tags=["Projects"])


@router.get("", response_model=List[ProjectResponse])
def get_projects():
    with db_session() as session:
        projects = session.query(Project).order_by(Project.created_at.asc()).all()
        return projects


@router.post("", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
def create_project(project: ProjectCreate):
    project_id = slugify(project.title)
    if not project_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid title. Could not generate a project ID slug.",
        )

    # Check if project already exists
    projects = load_projects_file()
    for p in projects:
        if p["id"] == project_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Project with ID '{project_id}' already exists.",
            )

    now_str = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    new_project = {
        "id": project_id,
        "title": project.title,
        "created_at": now_str,
        "done_clean_period": project.done_clean_period,
    }

    # Write registry file
    projects.append(new_project)
    write_projects_file(projects)

    # Initialize buckets.json in the project folder with defaults
    write_buckets_file(project_id)

    # Insert into database
    with db_session() as session:
        db_project = Project(
            id=project_id,
            title=project.title,
            created_at=now_str,
            done_clean_period=project.done_clean_period,
        )
        session.add(db_project)
        # Also sync buckets in database for this project
        for b in DEFAULT_BUCKETS:
            db_bucket = Bucket(
                project_id=project_id,
                name=b["name"],
                title=b["title"],
                position=b["position"],
                is_default=b.get("is_default", False),
            )
            session.add(db_bucket)

    return ProjectResponse(**new_project)


@router.put("/{project_id}", response_model=ProjectResponse)
def update_project(project_id: str, project_update: ProjectUpdate):
    projects = load_projects_file()
    project_found = None
    for p in projects:
        if p["id"] == project_id:
            if project_update.title is not None:
                p["title"] = project_update.title
            if "done_clean_period" in project_update.model_fields_set:
                p["done_clean_period"] = project_update.done_clean_period
            project_found = p
            break

    if not project_found:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project '{project_id}' not found.",
        )

    write_projects_file(projects)

    with db_session() as session:
        db_project = session.query(Project).filter(Project.id == project_id).first()
        if db_project:
            if project_update.title is not None:
                db_project.title = project_update.title
            if "done_clean_period" in project_update.model_fields_set:
                db_project.done_clean_period = project_update.done_clean_period

    return ProjectResponse(**project_found)


@router.delete("/{project_id}")
def delete_project(project_id: str):
    projects = load_projects_file()

    if len(projects) <= 1:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete the last remaining project.",
        )

    filtered_projects = [p for p in projects if p["id"] != project_id]

    if len(filtered_projects) == len(projects):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project '{project_id}' not found.",
        )

    # Save registry
    write_projects_file(filtered_projects)

    # Delete files
    delete_project_dir(project_id)

    # Update database
    with db_session() as session:
        db_project = session.query(Project).filter(Project.id == project_id).first()
        if db_project:
            session.delete(db_project)

    return {"status": "success", "detail": f"Project '{project_id}' deleted"}
