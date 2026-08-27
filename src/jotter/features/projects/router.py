"""FastAPI routes for Projects."""

from fastapi import APIRouter, Depends

from jotter.features.buckets.domain import DEFAULT_DOMAIN_BUCKETS
from jotter.features.projects.schemas import ProjectCreate, ProjectResponse, ProjectUpdate
from jotter.features.projects.service import ProjectApplicationService
from jotter.shared.deps import get_data_dir

router = APIRouter(prefix="/api/projects", tags=["projects"])


def get_service(data_dir: str = Depends(get_data_dir)) -> ProjectApplicationService:
    return ProjectApplicationService(data_dir)


@router.get("", response_model=list[ProjectResponse])
def list_projects(svc: ProjectApplicationService = Depends(get_service)):
    return svc.get_all_projects()


@router.post("", response_model=ProjectResponse, status_code=201)
def create_new_project(req: ProjectCreate, svc: ProjectApplicationService = Depends(get_service)):
    return svc.create_project(req, DEFAULT_DOMAIN_BUCKETS)


@router.patch("/{project_id}", response_model=ProjectResponse)
@router.put("/{project_id}", response_model=ProjectResponse)
def update_existing_project(
    project_id: str,
    req: ProjectUpdate,
    svc: ProjectApplicationService = Depends(get_service),
):
    return svc.update_project(project_id, req)


@router.delete("/{project_id}", status_code=204)
def delete_existing_project(project_id: str, svc: ProjectApplicationService = Depends(get_service)):
    svc.delete_project(project_id)
