"""FastAPI routes for Projects."""

import sqlite3

from fastapi import APIRouter, Depends

from jotter.features.buckets.domain import DEFAULT_DOMAIN_BUCKETS
from jotter.features.projects.schemas import ProjectCreate, ProjectResponse, ProjectUpdate
from jotter.features.projects.service import ProjectApplicationService
from jotter.shared.deps import get_data_dir, get_db_conn

router = APIRouter(prefix="/api/projects", tags=["projects"])


def get_project_service(
    data_dir: str = Depends(get_data_dir),
    conn: sqlite3.Connection = Depends(get_db_conn),
) -> ProjectApplicationService:
    return ProjectApplicationService.from_data_dir(data_dir, conn)


@router.get("", response_model=list[ProjectResponse])
def list_projects(svc: ProjectApplicationService = Depends(get_project_service)):
    return svc.get_all_projects()


@router.post("", response_model=ProjectResponse, status_code=201)
def create_new_project(req: ProjectCreate, svc: ProjectApplicationService = Depends(get_project_service)):
    return svc.create_project(req, DEFAULT_DOMAIN_BUCKETS)


@router.patch("/{project_id}", response_model=ProjectResponse)
@router.put("/{project_id}", response_model=ProjectResponse)
def update_existing_project(
    project_id: str,
    req: ProjectUpdate,
    svc: ProjectApplicationService = Depends(get_project_service),
):
    return svc.update_project(project_id, req)


@router.delete("/{project_id}", status_code=204)
def delete_existing_project(project_id: str, svc: ProjectApplicationService = Depends(get_project_service)):
    svc.delete_project(project_id)
