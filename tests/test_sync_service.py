from pathlib import Path

from jotter.features.buckets.service import BucketApplicationService
from jotter.features.sync.service import SyncApplicationService
from jotter.features.tasks.schemas import TaskCreate
from jotter.features.tasks.service import TaskApplicationService


def test_sync_auto_creates_missing_buckets_from_markdown(temp_dir, test_env):
    task_svc = TaskApplicationService(temp_dir)
    sync_svc = SyncApplicationService(temp_dir)
    bucket_svc = BucketApplicationService(temp_dir)

    # Directly create a task with a brand new bucket on disk
    task = task_svc.create_task("default", TaskCreate(title="Experiment 1", bucket="experiments"))
    assert task.bucket == "experiments"

    # Re-run database sync
    synced = sync_svc.sync_db_only()
    assert synced >= 1

    buckets = bucket_svc.get_all_buckets("default")
    assert any(b.name == "experiments" for b in buckets)


def test_sync_removes_deleted_markdown_files_from_index(temp_dir, test_env):
    task_svc = TaskApplicationService(temp_dir)
    sync_svc = SyncApplicationService(temp_dir)

    task = task_svc.create_task("default", TaskCreate(title="Temporary Task", bucket="todo"))
    assert len(task_svc.get_tasks("default")) >= 1

    # Simulate deleting markdown file from disk
    task_file = Path(temp_dir) / "default" / f"{task.id}.md"
    assert task_file.is_file()
    task_file.unlink()

    # Sync
    sync_svc.sync_db_only()

    # Verify task is removed from SQLite index
    tasks_after = task_svc.get_tasks("default")
    assert not any(t.id == task.id for t in tasks_after)
