from fastapi import APIRouter, HTTPException, Query, Request
from pydantic import BaseModel

from backend.services.git_service import get_git_history, restore_commit
from backend.services.sync_service import full_sync

router = APIRouter(prefix="/api/system", tags=["system"])


class RestoreRequest(BaseModel):
    commitHash: str
    projectId: str | None = None


@router.api_route("/sync", methods=["GET", "POST"])
def sync_system(request: Request):
    data_dir = request.app.state.config.data_dir
    try:
        count = full_sync(data_dir)
        return {"status": "success", "synchronized_tasks": count}
    except RuntimeError as e:
        # Conflict error status matching Go backend (409)
        raise HTTPException(status_code=409, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/info")
def get_system_info(request: Request):
    data_dir = request.app.state.config.data_dir
    version = getattr(request.app.state, "version", "2.9.1")
    return {
        "version": version,
        "data_dir": data_dir,
    }


@router.get("/history", response_model=list[dict[str, str]])
def get_history(projectId: str | None = Query(None), request: Request = None):
    data_dir = request.app.state.config.data_dir
    return get_git_history(data_dir, projectId)


@router.post("/restore")
def restore_snapshot(req: RestoreRequest, request: Request):
    data_dir = request.app.state.config.data_dir
    if not req.commitHash:
        raise HTTPException(status_code=400, detail="commitHash is required")

    try:
        restore_commit(data_dir, req.projectId, req.commitHash)
        count = full_sync(data_dir)
        return {"status": "success", "synchronized_tasks": count}
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/focus")
def focus_window():
    return {"status": "focused"}
