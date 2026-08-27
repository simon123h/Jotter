"""FastAPI routes for Projects."""

from fastapi import APIRouter, HTTPException, Request

from jotter.features.buckets.domain import DEFAULT_DOMAIN_BUCKETS
from jotter.features.projects.schemas import ProjectCreate, ProjectResponse, ProjectUpdate
from jotter.features.projects.service import ProjectApplicationService
from jotter.shared.exceptions import EntityNotFoundError, ValidationError

router = APIRouter(prefix="/api/projects", tags=["projects"])


@router.get("", response_model=list[ProjectResponse])
def list_projects(request: Request):
    data_dir = request.app.state.config.data_dir
    return ProjectApplicationService(data_dir).get_all_projects()


@router.post("", response_model=ProjectResponse, status_code=201)
def create_new_project(req: ProjectCreate, request: Request):
    data_dir = request.app.state.config.data_dir
    try:
        return ProjectApplicationService(data_dir).create_project(req, DEFAULT_DOMAIN_BUCKETS)
    except ValidationError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/{project_id}", response_model=ProjectResponse)
def update_existing_project(project_id: str, req: ProjectUpdate, request: Request):
    data_dir = request.app.state.config.data_dir
    try:
        return ProjectApplicationService(data_dir).update_project(project_id, req)
    except EntityNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{project_id}", status_code=204)
def delete_existing_project(project_id: str, request: Request):
    data_dir = request.app.state.config.data_dir
    try:
        ProjectApplicationService(data_dir).delete_project(project_id)
    except ValidationError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except EntityNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
