"""Bucket service facade delegating to BucketApplicationService and BucketRepository."""

from typing import Any

from jotter.application.services.bucket_service import BucketApplicationService
from jotter.domain.bucket import DEFAULT_DOMAIN_BUCKETS
from jotter.domain.exceptions import EntityNotFoundError, ValidationError
from jotter.infrastructure.repositories.bucket_repository import BucketRepository
from jotter.models.bucket import BucketCreate, BucketResponse, BucketUpdate

DEFAULT_BUCKETS = DEFAULT_DOMAIN_BUCKETS


def get_all_buckets(project_id: str) -> list[BucketResponse]:
    return BucketApplicationService("").get_all_buckets(project_id)


def get_bucket(project_id: str, name: str) -> BucketResponse | None:
    try:
        return BucketApplicationService("").get_bucket(project_id, name)
    except Exception:
        return None


def create_bucket(data_dir: str, project_id: str, req: BucketCreate) -> BucketResponse:
    try:
        return BucketApplicationService(data_dir).create_bucket(project_id, req)
    except ValidationError as e:
        raise ValueError(str(e))


def update_bucket(data_dir: str, project_id: str, name: str, req: BucketUpdate) -> BucketResponse:
    try:
        return BucketApplicationService(data_dir).update_bucket(project_id, name, req)
    except EntityNotFoundError as e:
        raise KeyError(str(e))
    except ValidationError as e:
        raise ValueError(str(e))


def delete_bucket(data_dir: str, project_id: str, name: str) -> None:
    try:
        BucketApplicationService(data_dir).delete_bucket(project_id, name)
    except ValidationError as e:
        raise ValueError(str(e))
    except EntityNotFoundError as e:
        raise KeyError(str(e))


def sync_buckets_file(data_dir: str, project_id: str) -> None:
    BucketRepository(data_dir).sync_buckets_file(project_id)


def load_buckets_file(data_dir: str, project_id: str) -> list[dict[str, Any]]:
    return BucketRepository(data_dir).load_buckets_file(project_id)


def write_buckets_file(data_dir: str, project_id: str, buckets: list[dict[str, Any]]) -> None:
    BucketRepository(data_dir).write_buckets_file(project_id, buckets)
