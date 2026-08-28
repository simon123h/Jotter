"""FastAPI routes for System Sync, Git history, Info, and Restore."""

import sqlite3
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel

from jotter.features.sync.git_adapter import (
    get_git_history,
    git_restore,
    is_git_installed,
)
from jotter.features.sync.service import SyncApplicationService
from jotter.shared.deps import get_data_dir, get_db_conn

router = APIRouter(prefix="/api/system", tags=["system"])


class RestoreRequest(BaseModel):
    commitHash: str


def get_sync_service(
    data_dir: str = Depends(get_data_dir),
    conn: sqlite3.Connection = Depends(get_db_conn),
) -> SyncApplicationService:
    return SyncApplicationService.from_data_dir(data_dir, conn)


@router.api_route("/sync", methods=["GET", "POST"])
def trigger_sync(svc: SyncApplicationService = Depends(get_sync_service)):
    synced_count = svc.full_sync()
    return {"status": "success", "synced": synced_count}


@router.get("/info")
def get_system_info(request: Request, data_dir: str = Depends(get_data_dir)):
    config = request.app.state.config
    version = getattr(request.app.state, "version", "3.0.0b1")
    git_inst = is_git_installed()
    return {
        "version": version,
        "data_dir": data_dir,
        "dataDir": data_dir,
        "port": config.port,
        "git_installed": git_inst,
        "gitInstalled": git_inst,
    }


@router.get("/history/{project_id}")
def get_project_git_history(project_id: str, data_dir: str = Depends(get_data_dir)):
    proj_dir = str(Path(data_dir) / project_id)
    history = get_git_history(proj_dir)
    return {"history": history}


@router.post("/restore/{project_id}")
def restore_project_commit(
    project_id: str,
    req: RestoreRequest,
    data_dir: str = Depends(get_data_dir),
    svc: SyncApplicationService = Depends(get_sync_service),
):
    if not req.commitHash or not req.commitHash.strip():
        raise HTTPException(status_code=400, detail="commitHash is required")
    proj_dir = str(Path(data_dir) / project_id)
    try:
        git_restore(proj_dir, req.commitHash)
        svc.sync_db_only()
        return {"status": "ok", "message": f"Restored to {req.commitHash}"}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/restore")
def restore_default_commit(
    req: RestoreRequest,
    data_dir: str = Depends(get_data_dir),
    svc: SyncApplicationService = Depends(get_sync_service),
):
    return restore_project_commit("default", req, data_dir, svc)
