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
