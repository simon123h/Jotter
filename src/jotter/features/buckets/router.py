"""FastAPI routes for Buckets (Columns)."""

import sqlite3

from fastapi import APIRouter, Depends

from jotter.features.buckets.schemas import BucketCreate, BucketResponse, BucketUpdate
from jotter.features.buckets.service import BucketApplicationService
from jotter.shared.deps import get_data_dir, get_db_conn

router = APIRouter(prefix="/api/projects/{project_id}/buckets", tags=["buckets"])


def get_bucket_service(
    data_dir: str = Depends(get_data_dir),
    conn: sqlite3.Connection = Depends(get_db_conn),
) -> BucketApplicationService:
    return BucketApplicationService.from_data_dir(data_dir, conn)


@router.get("", response_model=list[BucketResponse])
def list_buckets(project_id: str, svc: BucketApplicationService = Depends(get_bucket_service)):
    return svc.get_all_buckets(project_id)


@router.post("", response_model=BucketResponse, status_code=201)
def create_new_bucket(
    project_id: str,
    req: BucketCreate,
    svc: BucketApplicationService = Depends(get_bucket_service),
):
    return svc.create_bucket(project_id, req)


@router.patch("/{name}", response_model=BucketResponse)
@router.put("/{name}", response_model=BucketResponse)
def update_existing_bucket(
    project_id: str,
    name: str,
    req: BucketUpdate,
    svc: BucketApplicationService = Depends(get_bucket_service),
):
    return svc.update_bucket(project_id, name, req)


@router.delete("/{name}", status_code=204)
def delete_existing_bucket(
    project_id: str,
    name: str,
    svc: BucketApplicationService = Depends(get_bucket_service),
):
    svc.delete_bucket(project_id, name)
