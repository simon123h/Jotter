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


def test_sync_migrates_buckets_json_to_index_md(temp_dir, test_env):
    conn = get_db(str(Path(temp_dir) / "tasks.db"))
    sync_svc = SyncApplicationService.from_data_dir(temp_dir, conn)
    proj_svc = ProjectApplicationService.from_data_dir(temp_dir, conn)
    bucket_svc = BucketApplicationService.from_data_dir(temp_dir, conn)

    # 1. Simulate legacy buckets.json in alpha project folder
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

    # 2. Trigger sync
    sync_svc.sync_db_only()

    # 3. Verify index.md was generated
    alpha_index = alpha_dir / "index.md"
    assert alpha_index.is_file()
    alpha_content = alpha_index.read_text(encoding="utf-8")

    # Frontmatter should contain project metadata and buckets
    assert "type: project" in alpha_content
    assert "id: alpha" in alpha_content
    assert "title: Alpha" in alpha_content
    assert "name: ideas" in alpha_content
    assert "title: Ideas Column" in alpha_content

    proj_alpha = proj_svc.get_project("alpha")
    assert proj_alpha.title == "Alpha"

    # 4. Verify buckets were registered in SQLite
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


def test_commit_changes_commits_project_level_repo(temp_dir, test_env):
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

    # Call commit_changes
    sync_svc.commit_changes()

    history = get_git_history(proj_dir)
    assert len(history) >= 1
    assert history[0]["message"].startswith("jotter: 1 task created")


def test_commit_changes_with_global_workspace_git(temp_dir, test_env):
    from jotter.features.sync.git_adapter import get_git_history, run_git

    conn = get_db(str(Path(temp_dir) / "tasks.db"))
    sync_svc = SyncApplicationService.from_data_dir(temp_dir, conn)
    task_svc = TaskApplicationService.from_data_dir(temp_dir, conn)

    # Initialize workspace as git repo
    root_dir = Path(temp_dir)
    run_git(["init", "-b", "main"], cwd=root_dir)
    run_git(["config", "user.name", "Test"], cwd=root_dir)
    run_git(["config", "user.email", "test@example.com"], cwd=root_dir)

    # Create a task
    task = task_svc.create_task("default", TaskCreate(title="Global Sync Task", bucket="todo"))
    assert task.title == "Global Sync Task"

    # Call commit_changes
    sync_svc.commit_changes()

    # Verify vault-level commit was created
    history = get_git_history(root_dir)
    assert len(history) >= 1
    assert history[0]["message"].startswith("jotter: 1 task created")

    # Verify the local SQLite index is never versioned
    tracked = run_git(["ls-files"], cwd=root_dir).stdout.splitlines()
    assert any(f.endswith(".md") for f in tracked)
    assert not any(f.startswith("tasks.db") for f in tracked)


def test_commit_changes_commits_canvas_files(temp_dir, test_env):
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

    # Call commit_changes
    sync_svc.commit_changes()

    history = get_git_history(proj_dir)
    assert len(history) >= 1
    assert history[0]["message"] == "jotter: 2 other files changed"


def test_reprojecting_an_unchanged_task_does_not_rewrite_its_row(temp_dir):
    from jotter.features.tasks.domain import Task
    from jotter.features.tasks.projector import TaskProjector
    from jotter.shared.db import create_sqlite_connection

    conn = create_sqlite_connection(f"{temp_dir}/tasks.db")
    conn.execute("INSERT INTO projects (id, title, created_at) VALUES ('p', 'P', '2024-01-01')")
    conn.execute("INSERT INTO buckets (project_id, name, title) VALUES ('p', 'todo', 'Todo')")
    projector = TaskProjector(conn)
    task = Task.create(project_id="p", title="One", bucket="todo", position=1000.0)
    updates = []
    conn.set_trace_callback(lambda sql: updates.append(sql) if "tasks_fts" in sql else None)

    projector.project_task_upsert(task)
    inserted = len(updates)
    projector.project_task_upsert(task)
    assert len(updates) == inserted  # unchanged: the update trigger (FTS rewrite) did not fire

    task.title = "Two"
    projector.project_task_upsert(task)
    assert len(updates) > inserted
    assert conn.execute("SELECT title FROM tasks").fetchone()["title"] == "Two"
    conn.close()


def _age_files(project_dir: Path, seconds: int = 3600) -> None:
    """Back-dates task files so their stat is trusted (very recent files are re-read on purpose)."""
    import os
    import time

    old = time.time() - seconds
    for f in project_dir.glob("*.md"):
        os.utime(f, (old, old))


def _count_reads(monkeypatch):
    from jotter.features.tasks.disk_repo import DiskTaskRepository

    reads = []
    original = DiskTaskRepository.read_task_file

    def counting(self, file_path, default_project_id):
        reads.append(Path(file_path).name)
        return original(self, file_path, default_project_id)

    monkeypatch.setattr(DiskTaskRepository, "read_task_file", counting)
    return reads


def test_sync_skips_unchanged_task_files(temp_dir, test_env, monkeypatch):
    conn = get_db(str(Path(temp_dir) / "tasks.db"))
    task_svc = TaskApplicationService.from_data_dir(temp_dir, conn)
    sync_svc = SyncApplicationService.from_data_dir(temp_dir, conn)
    task_svc.create_task("default", TaskCreate(title="One", bucket="todo"))
    task_svc.create_task("default", TaskCreate(title="Two", bucket="todo"))
    _age_files(Path(temp_dir) / "default")

    sync_svc.sync_db_only()  # records the stats
    reads = _count_reads(monkeypatch)

    assert sync_svc.sync_db_only() >= 2
    assert reads == []


def test_sync_rereads_changed_files_and_when_forced(temp_dir, test_env, monkeypatch):
    import os

    conn = get_db(str(Path(temp_dir) / "tasks.db"))
    task_svc = TaskApplicationService.from_data_dir(temp_dir, conn)
    sync_svc = SyncApplicationService.from_data_dir(temp_dir, conn)
    changed = task_svc.create_task("default", TaskCreate(title="Changed", bucket="todo"))
    task_svc.create_task("default", TaskCreate(title="Same", bucket="todo"))
    project_dir = Path(temp_dir) / "default"
    _age_files(project_dir)
    sync_svc.sync_db_only()
    reads = _count_reads(monkeypatch)

    # Same size, different mtime: must still be noticed
    path = project_dir / f"{changed.id}.md"
    content = path.read_text(encoding="utf-8").replace("Changed", "Chunged")
    path.write_text(content, encoding="utf-8")
    old = path.stat().st_mtime - 100
    os.utime(path, (old, old))

    sync_svc.sync_db_only()
    assert reads == [path.name]
    assert conn.execute("SELECT title FROM tasks WHERE id = ?", (changed.id,)).fetchone()["title"] == "Chunged"

    reads.clear()
    sync_svc.sync_db_only(force=True)
    assert len(reads) == 2


def test_sync_rereads_recently_modified_files(temp_dir, test_env, monkeypatch):
    conn = get_db(str(Path(temp_dir) / "tasks.db"))
    task_svc = TaskApplicationService.from_data_dir(temp_dir, conn)
    sync_svc = SyncApplicationService.from_data_dir(temp_dir, conn)
    task_svc.create_task("default", TaskCreate(title="Fresh", bucket="todo"))
    sync_svc.sync_db_only()
    reads = _count_reads(monkeypatch)

    sync_svc.sync_db_only()  # mtime is within the racy window, so the stat was never trusted
    assert len(reads) == 1


def test_sync_still_prunes_unchanged_expired_done_tasks(temp_dir, test_env, monkeypatch):
    conn = get_db(str(Path(temp_dir) / "tasks.db"))
    proj_svc = ProjectApplicationService.from_data_dir(temp_dir, conn)
    task_svc = TaskApplicationService.from_data_dir(temp_dir, conn)
    sync_svc = SyncApplicationService.from_data_dir(temp_dir, conn)
    proj_svc.create_project(ProjectCreate(title="Proj", id="proj"))
    task = task_svc.create_task("proj", TaskCreate(title="Old done", bucket="done"))
    project_dir = Path(temp_dir) / "proj"
    path = project_dir / f"{task.id}.md"
    old_iso = (datetime.now(timezone.utc) - timedelta(days=10)).isoformat()
    path.write_text(path.read_text(encoding="utf-8").replace(task.updated_at, old_iso), encoding="utf-8")
    _age_files(project_dir)
    sync_svc.sync_db_only()  # indexes the task (retention disabled)
    assert path.exists()

    (Path(temp_dir) / "settings.json").write_text(json.dumps({"doneCleanPeriod": 7}), encoding="utf-8")
    reads = _count_reads(monkeypatch)
    sync_svc.sync_db_only()
    assert reads == []  # unchanged file was not parsed...
    assert not path.exists()  # ...yet retention applied from the indexed dates


def test_startup_sync_rebuilds_only_when_the_app_version_changes(temp_dir, test_env, monkeypatch):
    from jotter.features.sync import service as sync_module

    conn = get_db(str(Path(temp_dir) / "tasks.db"))
    task_svc = TaskApplicationService.from_data_dir(temp_dir, conn)
    sync_svc = SyncApplicationService.from_data_dir(temp_dir, conn)
    task_svc.create_task("default", TaskCreate(title="One", bucket="todo"))
    _age_files(Path(temp_dir) / "default")

    monkeypatch.setattr(sync_module, "_app_version", lambda: "1.0.0")
    reads = _count_reads(monkeypatch)

    sync_svc.sync_on_startup()  # first open of this index: full rebuild
    assert len(reads) == 1

    reads.clear()
    sync_svc.sync_on_startup()  # same version: unchanged files are skipped
    assert reads == []

    monkeypatch.setattr(sync_module, "_app_version", lambda: "1.1.0")
    sync_svc.sync_on_startup()  # upgrade: rebuild again
    assert len(reads) == 1


def test_manual_sync_endpoint_rereads_every_file(test_env, monkeypatch):
    client, temp_dir = test_env
    client.post("/api/projects/default/tasks", json={"title": "One", "bucket": "todo"})
    _age_files(Path(temp_dir) / "default")
    client.post("/api/system/sync")
    reads = _count_reads(monkeypatch)

    assert client.post("/api/system/sync").status_code == 200
    assert len(reads) == 1


def test_recording_a_file_stat_does_not_rewrite_the_fts_entry(temp_dir):
    from jotter.features.tasks.domain import Task
    from jotter.features.tasks.projector import TaskProjector
    from jotter.shared.db import create_sqlite_connection

    conn = create_sqlite_connection(f"{temp_dir}/stat.db")
    conn.execute("INSERT INTO projects (id, title, created_at) VALUES ('p', 'P', '2024-01-01')")
    conn.execute("INSERT INTO buckets (project_id, name, title) VALUES ('p', 'todo', 'Todo')")
    projector = TaskProjector(conn)
    task = Task.create(project_id="p", title="One", bucket="todo", position=1000.0)
    projector.project_task_upsert(task)
    fts = []
    conn.set_trace_callback(lambda sql: fts.append(sql) if "tasks_fts" in sql else None)

    projector.project_task_upsert(task, (123, 456))  # only the file stat differs

    assert fts == []
    assert conn.execute("SELECT file_mtime_ns FROM tasks").fetchone()[0] == 123
    conn.close()


def test_sync_does_not_rewrite_project_manifests_when_nothing_changed(temp_dir, monkeypatch):
    import jotter.shared.fs as fs

    vault = Path(temp_dir)
    (vault / "default").mkdir()
    (vault / "default" / "a.md").write_text(
        "---\ntype: task\nid: a\nproject_id: default\ntitle: A\nstatus: todo\nposition: 1000.0\n---\n", encoding="utf-8"
    )
    conn = get_db(str(vault / "tasks.db"))
    sync_svc = SyncApplicationService.from_data_dir(vault, conn)
    sync_svc.sync_db_only()  # creates and settles the manifest

    writes = []
    original = fs.atomic_write
    monkeypatch.setattr(
        fs, "atomic_write", lambda path, *a, **k: writes.append(Path(path).name) or original(path, *a, **k)
    )
    sync_svc.sync_db_only()
    sync_svc.sync_db_only()

    assert writes == []
