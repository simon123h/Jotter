"""Silent background filesystem watcher for local Markdown files.

Automatically reconciles Markdown changes from disk into the SQLite read-model
without requiring manual sync button clicks from the user.
"""

import logging
import threading
import time
from collections.abc import Callable
from pathlib import Path

logger = logging.getLogger(__name__)

try:
    from watchdog.events import FileSystemEvent, FileSystemEventHandler
    from watchdog.observers import Observer

    HAS_WATCHDOG = True
except ImportError:
    HAS_WATCHDOG = False
    FileSystemEventHandler = object  # type: ignore


class MarkdownFileEventHandler(FileSystemEventHandler):
    """Event handler that filters for Markdown file changes and debounces sync calls."""

    IGNORED_PATTERNS = {
        ".git",
        ".stfolder",
        ".stignore",
        ".tmp",
        "tasks.db",
        "tasks.db-wal",
        "tasks.db-shm",
        ".tempmediastorage",
    }

    @classmethod
    def register_recent_write(cls, path: Path | str, ttl_seconds: float = 2.0) -> None:
        """Records a path written by Jotter itself to suppress redundant watcher echo events."""
        from jotter.shared.fs import register_recent_self_write

        register_recent_self_write(path, ttl_seconds=ttl_seconds)

    @classmethod
    def is_recent_self_write(cls, path_str: str) -> bool:
        from jotter.shared.fs import is_recent_self_write

        return is_recent_self_write(path_str)

    def __init__(self, on_change_callback: Callable[[], None], debounce_seconds: float = 0.25):
        super().__init__()
        self.on_change_callback = on_change_callback
        self.debounce_seconds = debounce_seconds
        self._timer: threading.Timer | None = None
        self._lock = threading.Lock()

    def _should_ignore(self, path_str: str) -> bool:
        # 1. Suppress recent self-writes from within this process (eliminates watcher echo)
        if self.is_recent_self_write(path_str):
            return True

        norm = path_str.replace("\\", "/").lower()
        parts = norm.split("/")
        # Ignore hidden / temporary files and directories
        for part in parts:
            if part.startswith(".tmp_") or part.endswith(".tmp"):
                return True
            for ign in self.IGNORED_PATTERNS:
                if ign in part:
                    return True
        # Only watch Markdown files and directories (for project additions/deletions)
        path = Path(path_str)
        if path.suffix and path.suffix.lower() != ".md":
            return True
        return False

    def _schedule_sync(self):
        with self._lock:
            if self._timer is not None:
                self._timer.cancel()
            self._timer = threading.Timer(self.debounce_seconds, self._trigger_sync)
            self._timer.daemon = True
            self._timer.start()

    def cancel_timer(self):
        with self._lock:
            if self._timer is not None:
                self._timer.cancel()
                self._timer = None

    def _trigger_sync(self):
        try:
            self.on_change_callback()
        except Exception as e:
            logger.warning("Filesystem watcher sync callback failed: %s", e)

    def on_created(self, event: "FileSystemEvent") -> None:
        if not self._should_ignore(event.src_path):
            self._schedule_sync()

    def on_modified(self, event: "FileSystemEvent") -> None:
        if not self._should_ignore(event.src_path):
            self._schedule_sync()

    def on_deleted(self, event: "FileSystemEvent") -> None:
        if not self._should_ignore(event.src_path):
            self._schedule_sync()

    def on_moved(self, event: "FileSystemEvent") -> None:
        dest = getattr(event, "dest_path", "")
        if not self._should_ignore(event.src_path) or (dest and not self._should_ignore(dest)):
            self._schedule_sync()


class FileWatcherService:
    """Manages the lifecycle of the background filesystem watcher for a Jotter data directory."""

    def __init__(
        self,
        data_dir: Path | str,
        debounce_seconds: float = 0.25,
        on_external_change: Callable[[], None] | None = None,
    ):
        self.on_external_change = on_external_change
        self.data_dir = Path(data_dir).resolve()
        self.debounce_seconds = debounce_seconds
        self.observer: Observer | None = None
        self.handler: MarkdownFileEventHandler | None = None
        self.is_running = False
        self.last_sync_timestamp: float = time.time()
        self.change_count: int = 0
        self._lock = threading.Lock()
        self._sync_lock = threading.Lock()

    def _on_fs_change(self) -> None:
        if not self.is_running:
            return
        # Ensure only one sync runs at a time and stop() can wait for it to complete
        with self._sync_lock:
            if not self.is_running:
                return
            from jotter.features.sync.service import SyncApplicationService
            from jotter.shared.db import create_sqlite_connection

            db_path = self.data_dir / "tasks.db"
            try:
                conn = create_sqlite_connection(db_path)
                try:
                    sync_svc = SyncApplicationService.from_data_dir(self.data_dir, conn)
                    synced = sync_svc.sync_db_only()
                    with self._lock:
                        self.last_sync_timestamp = time.time()
                        self.change_count += 1
                    logger.debug("Filesystem watcher silently reconciled database (%d tasks)", synced)
                    if self.on_external_change:
                        self.on_external_change()
                finally:
                    conn.close()
            except Exception as e:
                logger.debug("Watcher sync skipped or failed during shutdown/transition: %s", e)

    def start(self) -> bool:
        """Starts watching data_dir in a background daemon thread."""
        if not HAS_WATCHDOG:
            logger.warning("watchdog package not installed; silent filesystem watcher disabled.")
            return False

        if self.is_running:
            return True

        try:
            self.data_dir.mkdir(parents=True, exist_ok=True)
            self.handler = MarkdownFileEventHandler(self._on_fs_change, self.debounce_seconds)
            self.observer = Observer()
            self.observer.schedule(self.handler, str(self.data_dir), recursive=True)
            self.observer.daemon = True
            self.observer.start()
            self.is_running = True
            logger.info("Filesystem watcher started for %s", self.data_dir)
            return True
        except Exception as e:
            logger.warning("Failed to start filesystem watcher for %s: %s", self.data_dir, e)
            self.observer = None
            self.handler = None
            self.is_running = False
            return False

    def stop(self) -> None:
        """Stops the watcher thread and waits for any pending sync execution to finish."""
        self.is_running = False
        if self.handler:
            self.handler.cancel_timer()
            self.handler = None
        if self.observer:
            try:
                self.observer.stop()
                self.observer.join(timeout=3.0)
            except Exception as e:
                logger.warning("Error stopping filesystem watcher: %s", e)
            finally:
                self.observer = None
                logger.info("Filesystem watcher stopped.")
        # Wait for any in-flight sync to complete so files are not being written
        # while temporary directories are being cleaned up
        with self._sync_lock:
            pass
