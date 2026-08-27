from fastapi import APIRouter, HTTPException, Request

from jotter.models.project import ProjectCreate, ProjectResponse, ProjectUpdate
from jotter.services.bucket_service import DEFAULT_BUCKETS
from jotter.services.project_service import (
    create_project,
    delete_project,
    get_all_projects,
    update_project,
)

router = APIRouter(prefix="/api/projects", tags=["projects"])


@router.get("", response_model=list[ProjectResponse])
def list_projects(request: Request):
    data_dir = request.app.state.config.data_dir
    return get_all_projects(data_dir)


@router.post("", response_model=ProjectResponse, status_code=201)
def create_new_project(req: ProjectCreate, request: Request):
    data_dir = request.app.state.config.data_dir
    try:
        return create_project(data_dir, req, DEFAULT_BUCKETS)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/{project_id}", response_model=ProjectResponse)
def update_existing_project(project_id: str, req: ProjectUpdate, request: Request):
    data_dir = request.app.state.config.data_dir
    try:
        return update_project(data_dir, project_id, req)
    except KeyError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{project_id}", status_code=204)
def delete_existing_project(project_id: str, request: Request):
    data_dir = request.app.state.config.data_dir
    try:
        delete_project(data_dir, project_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except KeyError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
