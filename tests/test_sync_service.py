from pathlib import Path

from jotter.features.buckets.service import BucketApplicationService
from jotter.features.sync.service import SyncApplicationService
from jotter.features.tasks.schemas import TaskCreate
from jotter.features.tasks.service import TaskApplicationService
from jotter.shared.db import get_db


def test_sync_auto_creates_missing_buckets_from_markdown(temp_dir, test_env):
    conn = get_db(str(Path(temp_dir) / "tasks.db"))
    task_svc = TaskApplicationService.from_data_dir(temp_dir, conn)
    sync_svc = SyncApplicationService.from_data_dir(temp_dir, conn)
    bucket_svc = BucketApplicationService.from_data_dir(temp_dir, conn)

    # Directly create a task with a brand new bucket on disk
    task = task_svc.create_task("default", TaskCreate(title="Experiment 1", bucket="experiments"))
    assert task.bucket == "experiments"

    # Re-run database sync
    synced = sync_svc.sync_db_only()
    assert synced >= 1

    buckets = bucket_svc.get_all_buckets("default")
    assert any(b.name == "experiments" for b in buckets)


def test_sync_removes_deleted_markdown_files_from_index(temp_dir, test_env):
    conn = get_db(str(Path(temp_dir) / "tasks.db"))
    task_svc = TaskApplicationService.from_data_dir(temp_dir, conn)
    sync_svc = SyncApplicationService.from_data_dir(temp_dir, conn)

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


def test_sync_handles_legacy_dates_and_folder_project_override(temp_dir, test_env):
    conn = get_db(str(Path(temp_dir) / "tasks.db"))
    task_svc = TaskApplicationService.from_data_dir(temp_dir, conn)
    sync_svc = SyncApplicationService.from_data_dir(temp_dir, conn)

    # Write a markdown file with legacy frontmatter (mismatched project_id, natural due_date)
    proj_dir = Path(temp_dir) / "legacy-project"
    proj_dir.mkdir(parents=True, exist_ok=True)
    legacy_file = proj_dir / "legacy123.md"
    legacy_file.write_text(
        """---
id: legacy123
project_id: wrong-project
title: Legacy task with keyword due date
bucket: backlog
due_date: thisYear
---
Notes
""",
        encoding="utf-8",
    )

    # Sync
    synced = sync_svc.sync_db_only()
    assert synced >= 1

    # Task should be indexed in "legacy-project" with planned_date normalized
    tasks = task_svc.get_tasks("legacy-project")
    assert len(tasks) == 1
    assert tasks[0].id == "legacy123"
    assert tasks[0].project_id == "legacy-project"
    assert tasks[0].planned_date == "thisYear"
    assert tasks[0].due_date is None
