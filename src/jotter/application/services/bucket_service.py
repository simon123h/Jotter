"""Application service orchestrating Bucket use cases."""

from jotter.domain.bucket import Bucket
from jotter.domain.exceptions import ValidationError
from jotter.infrastructure.repositories.bucket_repository import BucketRepository
from jotter.infrastructure.repositories.sqlite_task_repository import SqliteTaskRepository
from jotter.models.bucket import BucketCreate, BucketResponse, BucketUpdate


class BucketApplicationService:
    def __init__(self, data_dir: str):
        self.data_dir = data_dir
        self.bucket_repo = BucketRepository(data_dir)
        self.sqlite_task_repo = SqliteTaskRepository()

    def get_all_buckets(self, project_id: str) -> list[BucketResponse]:
        buckets = self.bucket_repo.get_all(project_id)
        if not buckets:
            # Seed default buckets
            disk_buckets = self.bucket_repo.load_buckets_file(project_id)
            for b_data in disk_buckets:
                b = Bucket(
                    name=b_data["name"],
                    title=b_data["title"],
                    subtitle=b_data.get("subtitle", ""),
                    position=float(b_data.get("position", 1000.0)),
                    color=b_data.get("color"),
                    layout=b_data.get("layout", "list"),
                    max_tasks=b_data.get("max_tasks"),
                    is_default=bool(b_data.get("is_default", False)),
                )
                self.bucket_repo.save(project_id, b)
            buckets = self.bucket_repo.get_all(project_id)
        return [self._to_response(b) for b in buckets]

    def get_bucket(self, project_id: str, name: str) -> BucketResponse:
        b = self.bucket_repo.get(project_id, name)
        return self._to_response(b)

    def create_bucket(self, project_id: str, req: BucketCreate) -> BucketResponse:
        existing = self.bucket_repo.get_all(project_id)
        max_pos = max((b.position for b in existing), default=0.0)
        req_pos = getattr(req, "position", None)
        pos = req_pos if req_pos is not None else (max_pos + 1000.0)

        bucket = Bucket.create(
            title=req.title,
            subtitle=req.subtitle or "",
            position=pos,
            color=req.color,
            layout=req.layout or "list",
            max_tasks=req.max_tasks,
            is_default=req.is_default or False,
            name=getattr(req, "name", None),
        )

        self.bucket_repo.save(project_id, bucket)
        return self._to_response(bucket)

    def update_bucket(self, project_id: str, name: str, req: BucketUpdate) -> BucketResponse:
        bucket = self.bucket_repo.get(project_id, name)

        bucket.update_details(
            title=req.title,
            subtitle=req.subtitle,
            position=req.position,
            color=req.color,
            layout=req.layout,
            max_tasks=req.max_tasks,
            is_default=req.is_default,
        )

        self.bucket_repo.save(project_id, bucket)
        return self._to_response(bucket)

    def delete_bucket(self, project_id: str, name: str) -> None:
        cnt = self.bucket_repo.count_tasks_in_bucket(project_id, name)
        if cnt > 0:
            raise ValidationError(f"Cannot delete column '{name}' because it contains {cnt} task(s)")

        self.bucket_repo.delete(project_id, name)

    def _to_response(self, b: Bucket) -> BucketResponse:
        return BucketResponse(
            name=b.name,
            title=b.title,
            subtitle=b.subtitle,
            position=b.position,
            color=b.color,
            layout=b.layout,
            max_tasks=b.max_tasks,
            is_default=b.is_default,
        )
