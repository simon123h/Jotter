import time
from pathlib import Path

from jotter.features.sync.watcher import FileWatcherService, MarkdownFileEventHandler


def test_markdown_file_event_handler_ignore():
    changes = []
    handler = MarkdownFileEventHandler(lambda: changes.append(1), debounce_seconds=0.05)

    # Ignored paths
    assert handler._should_ignore("/path/to/.git/objects/abc") is True
    assert handler._should_ignore("/path/to/tasks.db") is True
    assert handler._should_ignore("/path/to/tasks.db-wal") is True
    assert handler._should_ignore("/path/to/.tmp_123.tmp") is True
    assert handler._should_ignore("/path/to/notes.txt") is True

    # Valid Markdown file
    assert handler._should_ignore("/path/to/default/task-1.md") is False

    # Self-write echo suppression
    MarkdownFileEventHandler.register_recent_write("/path/to/default/task-1.md", ttl_seconds=1.0)
    assert handler._should_ignore("/path/to/default/task-1.md") is True


def test_file_watcher_service_lifecycle_and_reconciliation(temp_dir):
    data_dir = Path(temp_dir)
    default_dir = data_dir / "default"
    default_dir.mkdir(parents=True, exist_ok=True)

    watcher = FileWatcherService(data_dir, debounce_seconds=0.1)
    started = watcher.start()
    assert started is True
    assert watcher.is_running is True

    try:
        # Write a new markdown task file directly to disk
        task_file = default_dir / "external-task.md"
        task_file.write_text(
            "---\ntype: task\nid: external-task\nproject_id: default\ntitle: External Task\nstatus: todo\nposition: 1000.0\n---\nBody from outside\n",
            encoding="utf-8",
        )

        # Wait for debounced watcher to run (poll up to 3 seconds for CI environments)
        start_time = time.time()
        while watcher.change_count < 1 and (time.time() - start_time) < 3.0:
            time.sleep(0.05)

        assert watcher.change_count >= 1
    finally:
        watcher.stop()
        assert watcher.is_running is False


def _task_md(task_id, title="T", bucket="todo"):
    return (
        f"---\ntype: task\nid: {task_id}\nproject_id: default\ntitle: {title}\nstatus: {bucket}\n"
        "position: 1000.0\n---\nBody\n"
    )


def _wait_for(predicate, timeout=3.0):
    start = time.time()
    while not predicate() and time.time() - start < timeout:
        time.sleep(0.05)
    return predicate()


def test_task_file_key_only_matches_project_task_files(temp_dir):
    from jotter.features.sync.watcher import task_file_key

    data_dir = Path(temp_dir)
    assert task_file_key(data_dir, str(data_dir / "default" / "abc.md")) == ("default", "abc")
    assert task_file_key(data_dir, str(data_dir / "default" / "index.md")) is None
    assert task_file_key(data_dir, str(data_dir / "default" / ".hidden.md")) is None
    assert task_file_key(data_dir, str(data_dir / "default" / "sub" / "abc.md")) is None
    assert task_file_key(data_dir, str(data_dir / "abc.md")) is None
    assert task_file_key(data_dir, "/elsewhere/default/abc.md") is None


def test_watcher_reconciles_only_changed_task_files(temp_dir, monkeypatch):
    from jotter.features.sync.service import SyncApplicationService
    from jotter.shared.db import create_sqlite_connection

    data_dir = Path(temp_dir)
    (data_dir / "default").mkdir()
    conn = create_sqlite_connection(data_dir / "tasks.db")
    SyncApplicationService.from_data_dir(data_dir, conn).sync_db_only()

    full_syncs = []
    original = SyncApplicationService.sync_db_only

    def counting(self):
        full_syncs.append(1)
        return original(self)

    monkeypatch.setattr(SyncApplicationService, "sync_db_only", counting)

    def titles():
        return {r["title"] for r in conn.execute("SELECT title FROM tasks")}

    watcher = FileWatcherService(data_dir, debounce_seconds=0.1)
    assert watcher.start()
    try:
        task_file = data_dir / "default" / "ext.md"
        task_file.write_text(_task_md("ext", "First"), encoding="utf-8")
        assert _wait_for(lambda: "First" in titles())

        task_file.write_text(_task_md("ext", "Second"), encoding="utf-8")
        assert _wait_for(lambda: "Second" in titles())

        task_file.unlink()
        assert _wait_for(lambda: "Second" not in titles())
        assert full_syncs == []

        # A new project folder cannot be handled incrementally
        (data_dir / "other").mkdir()
        assert _wait_for(lambda: bool(full_syncs))
    finally:
        watcher.stop()
        conn.close()


def test_sync_task_files_requires_full_sync_for_unknown_project(temp_dir):
    from jotter.features.sync.service import SyncApplicationService
    from jotter.shared.db import create_sqlite_connection

    data_dir = Path(temp_dir)
    (data_dir / "default").mkdir()
    conn = create_sqlite_connection(data_dir / "tasks.db")
    svc = SyncApplicationService.from_data_dir(data_dir, conn)
    svc.sync_db_only()
    try:
        assert svc.sync_task_files({("unknown", "x")}) is False
        assert svc.sync_task_files({("default", "missing")}) is True
    finally:
        conn.close()
