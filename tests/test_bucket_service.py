from pathlib import Path

import pytest

from jotter.features.buckets.schemas import BucketCreate, BucketUpdate
from jotter.features.buckets.service import BucketApplicationService
from jotter.features.tasks.schemas import TaskCreate, TaskMove
from jotter.features.tasks.service import TaskApplicationService
from jotter.shared.db import get_db
from jotter.shared.exceptions import ValidationError


def test_bucket_crud(temp_dir, test_env):
    conn = get_db(str(Path(temp_dir) / "tasks.db"))
    bucket_svc = BucketApplicationService.from_data_dir(temp_dir, conn)
    buckets = bucket_svc.get_all_buckets("default")
    assert len(buckets) == 5
    assert buckets[0].name == "backlog"

    # Create bucket
    new_b = bucket_svc.create_bucket("default", BucketCreate(title="Testing", color="#ff00ff"))
    assert new_b.name == "testing"
    assert new_b.title == "Testing"
    assert new_b.color == "#ff00ff"

    # Update bucket
    up_b = bucket_svc.update_bucket("default", "testing", BucketUpdate(title="QA & Testing", max_tasks=10))
    assert up_b.title == "QA & Testing"
    assert up_b.max_tasks == 10

    # Delete bucket
    bucket_svc.delete_bucket("default", "testing")
    buckets_after = bucket_svc.get_all_buckets("default")
    assert not any(b.name == "testing" for b in buckets_after)


def test_bucket_delete_safety_and_task_move(temp_dir, test_env):
    conn = get_db(str(Path(temp_dir) / "tasks.db"))
    bucket_svc = BucketApplicationService.from_data_dir(temp_dir, conn)
    task_svc = TaskApplicationService.from_data_dir(temp_dir, conn)

    # Create custom bucket
    bucket_svc.create_bucket("default", BucketCreate(title="Deployments"))

    # Create task in Deployments
    task = task_svc.create_task("default", TaskCreate(title="Deploy to prod", bucket="deployments"))
    assert task.bucket == "deployments"

    # Invariant: Cannot delete bucket with active tasks
    with pytest.raises(ValidationError) as exc:
        bucket_svc.delete_bucket("default", "deployments")
    assert "contains 1 task" in str(exc.value)

    # Move task out of Deployments
    task_svc.move_task("default", task.id, TaskMove(bucket="done", position=1000.0))

    # Now deletion should succeed
    bucket_svc.delete_bucket("default", "deployments")
