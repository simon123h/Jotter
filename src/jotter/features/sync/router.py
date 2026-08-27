"""FastAPI routes for System Sync, Git history, Info, and Restore."""

from pathlib import Path

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from jotter.features.sync.git_adapter import (
    get_git_history,
    git_restore,
    is_git_installed,
)
from jotter.features.sync.service import SyncApplicationService

router = APIRouter(prefix="/api/system", tags=["system"])


class RestoreRequest(BaseModel):
    commitHash: str


@router.post("/sync")
def trigger_sync(request: Request):
    data_dir = request.app.state.config.data_dir
    synced_count = SyncApplicationService(data_dir).full_sync()
    return {"status": "success", "synced": synced_count}


@router.get("/info")
def get_system_info(request: Request):
    config = request.app.state.config
    version = getattr(request.app.state, "version", "3.0.0b1")
    git_inst = is_git_installed()
    return {
        "version": version,
        "data_dir": config.data_dir,
        "dataDir": config.data_dir,
        "port": config.port,
        "git_installed": git_inst,
        "gitInstalled": git_inst,
    }


@router.get("/history/{project_id}")
def get_project_git_history(project_id: str, request: Request):
    data_dir = request.app.state.config.data_dir
    proj_dir = str(Path(data_dir) / project_id)
    history = get_git_history(proj_dir)
    return {"history": history}


@router.post("/restore/{project_id}")
def restore_project_commit(project_id: str, req: RestoreRequest, request: Request):
    if not req.commitHash or not req.commitHash.strip():
        raise HTTPException(status_code=400, detail="commitHash is required")
    data_dir = request.app.state.config.data_dir
    proj_dir = str(Path(data_dir) / project_id)
    try:
        git_restore(proj_dir, req.commitHash)
        SyncApplicationService(data_dir).sync_db_only()
        return {"status": "ok", "message": f"Restored to {req.commitHash}"}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/restore")
def restore_default_commit(req: RestoreRequest, request: Request):
    return restore_project_commit("default", req, request)
