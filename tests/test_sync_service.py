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


def test_sync_does_not_delete_task_created_concurrently_during_sync(temp_dir, test_env, monkeypatch):
    """Simulates a race condition where a task is created after get_all_task_files snapshot

    was taken, but before the SQLite cleanup step executes.
    """
    conn = get_db(str(Path(temp_dir) / "tasks.db"))
    task_svc = TaskApplicationService.from_data_dir(temp_dir, conn)
    sync_svc = SyncApplicationService.from_data_dir(temp_dir, conn)

    # Pre-populate with an existing task
    initial_task = task_svc.create_task("default", TaskCreate(title="Initial Task", bucket="todo"))

    orig_get_all_files = sync_svc.disk_task_repo.get_all_task_files

    # When get_all_task_files is called, intercept it and simulate a concurrent task creation
    # that happens AFTER get_all_task_files returns its snapshot.
    created_concurrent_task = []

    def mock_get_all_files(project_id: str):
        files = orig_get_all_files(project_id)
        # Concurrent task creation: writes disk file and inserts into SQLite
        new_task = task_svc.create_task("default", TaskCreate(title="Concurrent Task", bucket="todo"))
        created_concurrent_task.append(new_task)
        # Return snapshot from BEFORE new_task existed
        return files

    monkeypatch.setattr(sync_svc.disk_task_repo, "get_all_task_files", mock_get_all_files)

    # Run sync
    sync_svc.sync_db_only()

    # The concurrently created task must NOT have been deleted from SQLite!
    tasks_after = task_svc.get_tasks("default")
    concurrent_id = created_concurrent_task[0].id
    assert any(t.id == concurrent_id for t in tasks_after), "Concurrently created task was mistakenly deleted by sync!"
    assert any(t.id == initial_task.id for t in tasks_after)


def test_sync_does_not_delete_project_created_concurrently(temp_dir, test_env, monkeypatch):
    """Simulates a project created concurrently after discover_disk_projects snapshot."""
    conn = get_db(str(Path(temp_dir) / "tasks.db"))
    proj_svc = ProjectApplicationService.from_data_dir(temp_dir, conn)
    sync_svc = SyncApplicationService.from_data_dir(temp_dir, conn)

    orig_discover = sync_svc.project_repo.discover_disk_projects

    def mock_discover():
        disk_projects = orig_discover()
        # Concurrently create a project on disk and in DB
        proj_svc.create_project(ProjectCreate(title="Concurrent Project", id="concurrent-proj"))
        return disk_projects

    monkeypatch.setattr(sync_svc.project_repo, "discover_disk_projects", mock_discover)

    # Run sync
    sync_svc.sync_db_only()

    # The concurrently created project must NOT be deleted
    projects = proj_svc.get_all_projects()
    assert any(p.id == "concurrent-proj" for p in projects)


def test_sync_retains_tasks_on_transient_read_error(temp_dir, test_env, monkeypatch):
    """Verifies that if a task file fails to be read during a single sync pass (e.g. transient file lock),

    it is NOT purged from the SQLite index.
    """
    conn = get_db(str(Path(temp_dir) / "tasks.db"))
    task_svc = TaskApplicationService.from_data_dir(temp_dir, conn)
    sync_svc = SyncApplicationService.from_data_dir(temp_dir, conn)

    task = task_svc.create_task("default", TaskCreate(title="Important Locked Task", bucket="todo"))

    # Mock read_task_file to simulate a transient OS permission / sharing error on Windows
    orig_read = sync_svc.disk_task_repo.read_task_file

    def mock_read(file_path, default_project_id=None):
        if str(task.id) in str(file_path):
            raise OSError("WinError 32: The process cannot access the file because it is being used by another process")
        return orig_read(file_path, default_project_id)

    monkeypatch.setattr(sync_svc.disk_task_repo, "read_task_file", mock_read)

    # Run sync pass
    sync_svc.sync_db_only()

    # Task should still be preserved in SQLite index
    tasks = task_svc.get_tasks("default")
    assert any(t.id == task.id for t in tasks)


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


def test_sync_removes_deleted_project_and_does_not_resurrect_default(temp_dir, test_env):
    import shutil

    conn = get_db(str(Path(temp_dir) / "tasks.db"))
    sync_svc = SyncApplicationService.from_data_dir(temp_dir, conn)
    proj_svc = ProjectApplicationService.from_data_dir(temp_dir, conn)

    # 1. Create a custom project
    proj_svc.create_project(ProjectCreate(title="Personal Tasks", id="personal"))

    # Verify both default and personal exist initially
    projects = proj_svc.get_all_projects()
    proj_ids = [p.id for p in projects]
    assert "default" in proj_ids
    assert "personal" in proj_ids

    # 2. Delete default project directory from disk
    default_dir = Path(temp_dir) / "default"
    if default_dir.is_dir():
        shutil.rmtree(default_dir, ignore_errors=True)

    # 3. Trigger sync
    sync_svc.sync_db_only()

    # 4. Verify default project is pruned and NOT resurrected since personal still exists
    projects_after = proj_svc.get_all_projects()
    proj_ids_after = [p.id for p in projects_after]
    assert "personal" in proj_ids_after
    assert "default" not in proj_ids_after


def test_full_sync_commits_local_projects_without_remote(temp_dir, test_env):
    from jotter.features.sync.git_adapter import get_git_history, run_git

    conn = get_db(str(Path(temp_dir) / "tasks.db"))
    sync_svc = SyncApplicationService.from_data_dir(temp_dir, conn)
    task_svc = TaskApplicationService.from_data_dir(temp_dir, conn)

    proj_dir = Path(temp_dir) / "default"
    proj_dir.mkdir(parents=True, exist_ok=True)
    run_git(["init", "-b", "main"], cwd=proj_dir)
    run_git(["config", "user.name", "Test"], cwd=proj_dir)
    run_git(["config", "user.email", "test@example.com"], cwd=proj_dir)

    task = task_svc.create_task("default", TaskCreate(title="Test Git Sync Task", bucket="todo"))
    assert task.title == "Test Git Sync Task"

    # Call full_sync
    sync_svc.full_sync()

    history = get_git_history(proj_dir)
    assert len(history) >= 1
    assert "jotter: auto-sync" in history[0]["message"]


def test_full_sync_with_global_workspace_git(temp_dir, test_env):
    from jotter.features.sync.git_adapter import get_git_history, run_git

    conn = get_db(str(Path(temp_dir) / "tasks.db"))
    sync_svc = SyncApplicationService.from_data_dir(temp_dir, conn)
    task_svc = TaskApplicationService.from_data_dir(temp_dir, conn)

    # Initialize workspace as git repo
    root_dir = Path(temp_dir)
    run_git(["init", "-b", "main"], cwd=root_dir)
    run_git(["config", "user.name", "Test"], cwd=root_dir)
    run_git(["config", "user.email", "test@example.com"], cwd=root_dir)

    # Setup a local remote bare repository
    bare_remote = root_dir.parent / "bare_workspace.git"
    bare_remote.mkdir(parents=True, exist_ok=True)
    run_git(["init", "--bare", "-b", "main"], cwd=bare_remote)

    # Configure settings.json with gitRemoteUrl
    settings_file = root_dir / "settings.json"
    settings_file.write_text(json.dumps({"gitRemoteUrl": str(bare_remote)}), encoding="utf-8")

    # Create a task
    task = task_svc.create_task("default", TaskCreate(title="Global Sync Task", bucket="todo"))
    assert task.title == "Global Sync Task"

    # Call full_sync
    sync_svc.full_sync()

    # Verify global commit created and pushed
    history = get_git_history(root_dir)
    assert len(history) >= 1
    assert "jotter: auto-sync" in history[0]["message"]

    # Verify .gitignore was created
    gitignore_file = root_dir / ".gitignore"
    assert gitignore_file.is_file()
    assert "tasks.db" in gitignore_file.read_text(encoding="utf-8")


def test_full_sync_commits_canvas_files(temp_dir, test_env):
    from jotter.features.canvas.schemas import CanvasDocument, CanvasGenericNode
    from jotter.features.canvas.service import CanvasApplicationService
    from jotter.features.sync.git_adapter import get_git_history, run_git

    conn = get_db(str(Path(temp_dir) / "tasks.db"))
    sync_svc = SyncApplicationService.from_data_dir(temp_dir, conn)
    canvas_svc = CanvasApplicationService(temp_dir)

    proj_dir = Path(temp_dir) / "default"
    proj_dir.mkdir(parents=True, exist_ok=True)
    run_git(["init", "-b", "main"], cwd=proj_dir)
    run_git(["config", "user.name", "Test"], cwd=proj_dir)
    run_git(["config", "user.email", "test@example.com"], cwd=proj_dir)

    # Create a canvas
    canvas_svc.save_canvas(
        "default",
        "diagram",
        CanvasDocument(
            nodes=[CanvasGenericNode(id="node-1", type="text", x=0, y=0, width=100, height=100, text="Architecture")]
        ),
    )

    # Call full_sync
    sync_svc.full_sync()

    history = get_git_history(proj_dir)
    assert len(history) >= 1
    assert "jotter: auto-sync" in history[0]["message"]
