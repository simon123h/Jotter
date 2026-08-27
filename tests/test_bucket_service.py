import pytest

from jotter.models.bucket import BucketCreate, BucketUpdate
from jotter.models.task import TaskCreate, TaskMove
from jotter.services.bucket_service import (
    create_bucket,
    delete_bucket,
    get_all_buckets,
    update_bucket,
)
from jotter.services.task_service import create_task, move_task


def test_bucket_crud(temp_dir):
    # Default buckets seeded automatically
    buckets = get_all_buckets("default")
    assert len(buckets) >= 4
    names = [b.name for b in buckets]
    assert "backlog" in names
    assert "todo" in names

    # Create new bucket
    created = create_bucket(
        temp_dir,
        "default",
        BucketCreate(title="In Review", subtitle="Reviewing work", color="#9333ea"),
    )
    assert created.name == "in-review"
    assert created.title == "In Review"

    # Update bucket
    updated = update_bucket(
        temp_dir,
        "default",
        "in-review",
        BucketUpdate(title="Peer Review", color="#7c3aed"),
    )
    assert updated.title == "Peer Review"
    assert updated.color == "#7c3aed"

    # Verify updated list
    buckets_after = get_all_buckets("default")
    assert any(b.title == "Peer Review" for b in buckets_after)


def test_bucket_delete_safety_and_task_move(temp_dir):
    # 1. Create a custom bucket
    create_bucket(temp_dir, "default", BucketCreate(title="QA Testing"))

    # 2. Create tasks in QA Testing
    t1 = create_task(
        temp_dir,
        "default",
        TaskCreate(title="Test Feature X", bucket="qa-testing"),
    )
    assert t1.bucket == "qa-testing"

    # 3. Attempting to delete bucket with tasks directly raises ValueError
    with pytest.raises(ValueError, match="Cannot delete column"):
        delete_bucket(temp_dir, "default", "qa-testing")

    # 4. Move task to backlog first
    move_task(temp_dir, "default", t1.id, TaskMove(bucket="backlog", position=1000.0))

    # 5. Deleting empty bucket succeeds
    delete_bucket(temp_dir, "default", "qa-testing")

    # 6. Verify bucket is gone
    buckets = get_all_buckets("default")
    assert not any(b.name == "qa-testing" for b in buckets)
