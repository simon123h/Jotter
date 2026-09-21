"""FastAPI routes for System Sync, Git history, Info, and Restore."""

import sqlite3
from pathlib import Path
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel

from jotter.config import save_user_config
from jotter.features.sync.git_adapter import (
    get_git_history,
    git_restore,
    is_git_installed,
)
from jotter.features.sync.service import SyncApplicationService
from jotter.shared.db import create_sqlite_connection
from jotter.shared.deps import get_data_dir, get_db_conn

router = APIRouter(prefix="/api/system", tags=["system"])


class RestoreRequest(BaseModel):
    commitHash: str
    projectId: str | None = None
    project_id: str | None = None


class DataDirUpdateRequest(BaseModel):
    data_dir: str


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


@router.post("/data-dir")
@router.put("/data-dir")
def update_data_dir(
    req: DataDirUpdateRequest,
    request: Request,
):
    new_dir = req.data_dir.strip()
    if not new_dir:
        raise HTTPException(status_code=400, detail="data_dir cannot be empty")

    resolved_path = str(Path(new_dir).expanduser().resolve())
    Path(resolved_path).mkdir(parents=True, exist_ok=True)

    config = request.app.state.config
    config.data_dir = resolved_path

    # Persist in user config file
    save_user_config(config)

    # Reconnect and sync new database
    db_path = str(Path(resolved_path) / "tasks.db")
    request.app.state.db_path = db_path
    conn = create_sqlite_connection(db_path)
    request.app.state.db = conn

    # Trigger initial sync for the newly selected directory
    sync_svc = SyncApplicationService.from_data_dir(resolved_path, conn)
    synced_count = sync_svc.sync_db_only()

    return {
        "status": "ok",
        "data_dir": resolved_path,
        "dataDir": resolved_path,
        "synced": synced_count,
    }


@router.get("/history")
@router.get("/history/{project_id}")
def get_git_history_endpoint(
    project_id: str | None = None,
    projectId: str | None = Query(default=None),
    data_dir: str = Depends(get_data_dir),
) -> list[dict[str, Any]]:
    target_pid = project_id or projectId
    if target_pid and target_pid != "all":
        proj_dir = str(Path(data_dir) / target_pid)
    else:
        proj_dir = data_dir
    return get_git_history(proj_dir)


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
    target_pid = req.projectId or req.project_id or "default"
    return restore_project_commit(target_pid, req, data_dir, svc)
