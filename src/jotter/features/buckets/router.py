"""FastAPI routes for Buckets (Columns)."""

from fastapi import APIRouter, Request

from jotter.features.buckets.schemas import BucketCreate, BucketResponse, BucketUpdate
from jotter.features.buckets.service import BucketApplicationService

router = APIRouter(prefix="/api/projects/{project_id}/buckets", tags=["buckets"])


@router.get("", response_model=list[BucketResponse])
def list_buckets(project_id: str, request: Request):
    data_dir = request.app.state.config.data_dir
    return BucketApplicationService(data_dir).get_all_buckets(project_id)


@router.post("", response_model=BucketResponse, status_code=201)
def create_new_bucket(project_id: str, req: BucketCreate, request: Request):
    data_dir = request.app.state.config.data_dir
    return BucketApplicationService(data_dir).create_bucket(project_id, req)


@router.patch("/{name}", response_model=BucketResponse)
@router.put("/{name}", response_model=BucketResponse)
def update_existing_bucket(project_id: str, name: str, req: BucketUpdate, request: Request):
    data_dir = request.app.state.config.data_dir
    return BucketApplicationService(data_dir).update_bucket(project_id, name, req)


@router.delete("/{name}", status_code=204)
def delete_existing_bucket(project_id: str, name: str, request: Request):
    data_dir = request.app.state.config.data_dir
    BucketApplicationService(data_dir).delete_bucket(project_id, name)
