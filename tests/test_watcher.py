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


def test_file_watcher_service_lifecycle_and_reconciliation(temp_dir):
    data_dir = Path(temp_dir)
    default_dir = data_dir / "default"
    default_dir.mkdir(parents=True, exist_ok=True)

    watcher = FileWatcherService(data_dir, debounce_seconds=0.1)
    started = watcher.start()
    assert started is True
    assert watcher.is_running is True

    # Write a new markdown task file directly to disk
    task_file = default_dir / "external-task.md"
    task_file.write_text(
        "---\ntype: task\nid: external-task\nproject_id: default\ntitle: External Task\nstatus: todo\nposition: 1000.0\n---\nBody from outside\n",
        encoding="utf-8",
    )

    # Wait for debounced watcher to run
    time.sleep(0.4)

    assert watcher.change_count >= 1

    watcher.stop()
    assert watcher.is_running is False
