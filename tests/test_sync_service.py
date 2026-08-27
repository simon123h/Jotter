from pathlib import Path

from jotter.models.task import TaskCreate
from jotter.services.bucket_service import get_all_buckets
from jotter.services.sync_service import full_sync, sync_db_only
from jotter.services.task_service import create_task, get_tasks


def test_sync_auto_creates_missing_buckets_from_markdown(temp_dir):
    # Manually write a task file with an unlisted bucket "experimental"
    task_file = Path(temp_dir) / "default" / "01HEXP00000000000000000001.md"
    task_file.parent.mkdir(parents=True, exist_ok=True)
    task_file.write_text(
        """---
id: 01HEXP00000000000000000001
project_id: default
title: Experimental Feature
bucket: experimental
position: 1000.0
tags:
  - research
created_at: '2026-08-27T20:00:00Z'
updated_at: '2026-08-27T20:00:00Z'
---
Body content
""",
        encoding="utf-8",
    )

    # Sync
    count = full_sync(temp_dir)
    assert count >= 1

    # Verify bucket was dynamically indexed
    buckets = get_all_buckets("default")
    assert any(b.name == "experimental" for b in buckets)

    # Verify task is queryable
    tasks = get_tasks("default", bucket="experimental")
    assert len(tasks) == 1
    assert tasks[0].title == "Experimental Feature"


def test_sync_removes_deleted_markdown_files_from_index(temp_dir):
    t = create_task(
        temp_dir,
        "default",
        TaskCreate(title="Task to be deleted from disk", bucket="todo"),
    )

    # Verify present in SQLite
    tasks = get_tasks("default")
    assert any(task.id == t.id for task in tasks)

    # Delete markdown file from disk directly
    task_path = Path(temp_dir) / "default" / f"{t.id}.md"
    assert task_path.is_file()
    task_path.unlink()

    # Re-sync
    sync_db_only(temp_dir)

    # Verify removed from SQLite
    tasks_after = get_tasks("default")
    assert not any(task.id == t.id for task in tasks_after)
