import json
from datetime import datetime, timedelta, timezone
from pathlib import Path

from jotter.features.buckets.service import BucketApplicationService
from jotter.features.projects.schemas import ProjectCreate
from jotter.features.projects.service import ProjectApplicationService
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


def test_sync_prunes_expired_done_tasks_project_and_global(temp_dir, test_env):
    conn = get_db(str(Path(temp_dir) / "tasks.db"))
    task_svc = TaskApplicationService.from_data_dir(temp_dir, conn)
    sync_svc = SyncApplicationService.from_data_dir(temp_dir, conn)
    proj_svc = ProjectApplicationService.from_data_dir(temp_dir, conn)

    # 1. Project with specific done_clean_period = 7
    proj_svc.create_project(ProjectCreate(title="Proj A", id="proj-a", done_clean_period=7))

    # 2. Project with no clean period (will inherit global)
    proj_svc.create_project(ProjectCreate(title="Proj B", id="proj-b", done_clean_period=None))

    # Set global doneCleanPeriod = 14
    settings_file = Path(temp_dir) / "settings.json"
    settings_file.write_text(json.dumps({"doneCleanPeriod": 14}), encoding="utf-8")

    # Create old done task in Proj A (10 days old -> pruned because clean_period is 7)
    old_date = (datetime.now(timezone.utc) - timedelta(days=10)).isoformat()
    t_a_old = task_svc.create_task("proj-a", TaskCreate(title="Old Done A", bucket="done"))
    task_file_a_old = Path(temp_dir) / "proj-a" / f"{t_a_old.id}.md"
    task_file_a_old.write_text(
        f"---\nid: {t_a_old.id}\nproject_id: proj-a\ntitle: Old Done A\nbucket: done\nupdated_at: '{old_date}'\n---\n",
        encoding="utf-8",
    )

    # Create recent done task in Proj A (2 days old -> kept)
    recent_date = (datetime.now(timezone.utc) - timedelta(days=2)).isoformat()
    t_a_recent = task_svc.create_task("proj-a", TaskCreate(title="Recent Done A", bucket="done"))
    task_file_a_recent = Path(temp_dir) / "proj-a" / f"{t_a_recent.id}.md"
    task_file_a_recent.write_text(
        f"---\nid: {t_a_recent.id}\nproject_id: proj-a\ntitle: Recent Done A\nbucket: done\nupdated_at: '{recent_date}'\n---\n",
        encoding="utf-8",
    )

    # Create old done task in Proj B (20 days old -> pruned by global 14)
    very_old_date = (datetime.now(timezone.utc) - timedelta(days=20)).isoformat()
    t_b_old = task_svc.create_task("proj-b", TaskCreate(title="Old Done B", bucket="done"))
    task_file_b_old = Path(temp_dir) / "proj-b" / f"{t_b_old.id}.md"
    task_file_b_old.write_text(
        f"---\nid: {t_b_old.id}\nproject_id: proj-b\ntitle: Old Done B\nbucket: done\nupdated_at: '{very_old_date}'\n---\n",
        encoding="utf-8",
    )

    # Run sync
    sync_svc.sync_db_only()

    # Verify Proj A: old is pruned from disk & DB, recent is kept
    assert not task_file_a_old.is_file()
    assert task_file_a_recent.is_file()
    tasks_a = task_svc.get_tasks("proj-a")
    assert len(tasks_a) == 1
    assert tasks_a[0].id == t_a_recent.id

    # Verify Proj B: old is pruned by global setting
    assert not task_file_b_old.is_file()
    tasks_b = task_svc.get_tasks("proj-b")
    assert len(tasks_b) == 0
