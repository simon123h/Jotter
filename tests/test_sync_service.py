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

    # 1. Project with specific done_clean_period = 7 (overrides global)
    proj_svc.create_project(ProjectCreate(title="Proj A", id="proj-a", done_clean_period=7))

    # 2. Project with no clean period (will inherit global)
    proj_svc.create_project(ProjectCreate(title="Proj B", id="proj-b", done_clean_period=None))

    # 3. Project with explicit done_clean_period = 0 (disables deletion, overriding global)
    proj_svc.create_project(ProjectCreate(title="Proj C", id="proj-c", done_clean_period=0))

    # Set global doneCleanPeriod = 14
    settings_file = Path(temp_dir) / "settings.json"
    settings_file.write_text(json.dumps({"doneCleanPeriod": 14}), encoding="utf-8")

    # Create old done task in Proj A (10 days old -> pruned because project clean_period is 7)
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

    # Create old done task in Proj C (30 days old -> KEPT because Proj C explicitly disabled deletion with 0)
    t_c_old = task_svc.create_task("proj-c", TaskCreate(title="Old Done C", bucket="done"))
    task_file_c_old = Path(temp_dir) / "proj-c" / f"{t_c_old.id}.md"
    task_file_c_old.write_text(
        f"---\nid: {t_c_old.id}\nproject_id: proj-c\ntitle: Old Done C\nbucket: done\nupdated_at: '{very_old_date}'\n---\n",
        encoding="utf-8",
    )

    # Run sync
    sync_svc.sync_db_only()

    # Verify Proj A: old is pruned from disk & DB (project 7-day override), recent is kept
    assert not task_file_a_old.is_file()
    assert task_file_a_recent.is_file()
    tasks_a = task_svc.get_tasks("proj-a")
    assert len(tasks_a) == 1
    assert tasks_a[0].id == t_a_recent.id

    # Verify Proj B: old is pruned by global setting
    assert not task_file_b_old.is_file()
    tasks_b = task_svc.get_tasks("proj-b")
    assert len(tasks_b) == 0

    # Verify Proj C: old is preserved because project-specific 0 overrides global 14
    assert task_file_c_old.is_file()
    tasks_c = task_svc.get_tasks("proj-c")
    assert len(tasks_c) == 1
    assert tasks_c[0].id == t_c_old.id


def test_sync_migrates_projects_json_to_index_md(temp_dir, test_env):
    conn = get_db(str(Path(temp_dir) / "tasks.db"))
    sync_svc = SyncApplicationService.from_data_dir(temp_dir, conn)
    proj_svc = ProjectApplicationService.from_data_dir(temp_dir, conn)
    bucket_svc = BucketApplicationService.from_data_dir(temp_dir, conn)

    # 1. Simulate legacy projects.json in root data directory
    projects_json_path = Path(temp_dir) / "projects.json"
    projects_json_path.write_text(
        json.dumps(
            [
                {
                    "id": "alpha",
                    "title": "Alpha Project",
                    "description": "Alpha team notes and tasks",
                    "git_remote": "git@github.com:org/alpha.git",
                    "done_clean_period": 30,
                    "created_at": "2026-01-01T10:00:00Z",
                },
                {
                    "id": "beta",
                    "name": "Beta Board",
                    "description": "Beta project board",
                    "gitRemote": "https://github.com/org/beta.git",
                    "doneCleanPeriod": 7,
                },
            ]
        ),
        encoding="utf-8",
    )

    # 2. Simulate legacy buckets.json in alpha project folder
    alpha_dir = Path(temp_dir) / "alpha"
    alpha_dir.mkdir(parents=True, exist_ok=True)
    alpha_buckets_file = alpha_dir / "buckets.json"
    alpha_buckets_file.write_text(
        json.dumps(
            [
                {"name": "ideas", "title": "Ideas Column", "color": "#123456", "position": 100.0},
                {"name": "done", "title": "Finished", "color": "#00ff00", "position": 200.0},
            ]
        ),
        encoding="utf-8",
    )

    # 3. Trigger sync
    sync_svc.sync_db_only()

    # 4. Verify index.md was generated for both projects
    alpha_index = alpha_dir / "index.md"
    assert alpha_index.is_file()
    alpha_content = alpha_index.read_text(encoding="utf-8")

    # Frontmatter should contain project metadata and buckets
    assert "type: project" in alpha_content
    assert "id: alpha" in alpha_content
    assert "title: Alpha Project" in alpha_content
    assert "description: Alpha team notes and tasks" in alpha_content
    assert "done_clean_period: 30" in alpha_content
    assert "name: ideas" in alpha_content
    assert "title: Ideas Column" in alpha_content

    # git_remote must NOT be written to index.md
    assert "git_remote" not in alpha_content
    assert "git@github.com:org/alpha.git" not in alpha_content

    # Beta project
    beta_dir = Path(temp_dir) / "beta"
    beta_index = beta_dir / "index.md"
    assert beta_index.is_file()
    beta_content = beta_index.read_text(encoding="utf-8")
    assert "id: beta" in beta_content
    assert "title: Beta Board" in beta_content
    assert "done_clean_period: 7" in beta_content
    assert "git_remote" not in beta_content
    assert "https://github.com/org/beta.git" not in beta_content

    # 5. Verify SQLite contains the git_remote and project metadata locally
    proj_alpha = proj_svc.get_project("alpha")
    assert proj_alpha.id == "alpha"
    assert proj_alpha.title == "Alpha Project"
    assert proj_alpha.git_remote == "git@github.com:org/alpha.git"
    assert proj_alpha.done_clean_period == 30

    proj_beta = proj_svc.get_project("beta")
    assert proj_beta.id == "beta"
    assert proj_beta.title == "Beta Board"
    assert proj_beta.git_remote == "https://github.com/org/beta.git"
    assert proj_beta.done_clean_period == 7

    # 6. Verify buckets were registered in SQLite
    alpha_buckets = bucket_svc.get_all_buckets("alpha")
    assert len(alpha_buckets) == 2
    assert alpha_buckets[0].name == "ideas"
    assert alpha_buckets[0].title == "Ideas Column"
    assert alpha_buckets[1].name == "done"

