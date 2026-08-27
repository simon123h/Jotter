from typing import List
from fastapi import APIRouter, HTTPException, Request
from backend.models.bucket import BucketCreate, BucketResponse, BucketUpdate
from backend.services.bucket_service import (
    create_bucket,
    delete_bucket,
    get_all_buckets,
    update_bucket,
)

router = APIRouter(prefix="/api/projects/{project_id}/buckets", tags=["buckets"])


@router.get("", response_model=List[BucketResponse])
def list_buckets(project_id: str):
    return get_all_buckets(project_id)


@router.post("", response_model=BucketResponse, status_code=201)
def create_new_bucket(project_id: str, req: BucketCreate, request: Request):
    data_dir = request.app.state.config.data_dir
    try:
        return create_bucket(data_dir, project_id, req)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/{name}", response_model=BucketResponse)
def update_existing_bucket(project_id: str, name: str, req: BucketUpdate, request: Request):
    data_dir = request.app.state.config.data_dir
    try:
        return update_bucket(data_dir, project_id, name, req)
    except KeyError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{name}", status_code=204)
def delete_existing_bucket(project_id: str, name: str, request: Request):
    data_dir = request.app.state.config.data_dir
    try:
        delete_bucket(data_dir, project_id, name)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
