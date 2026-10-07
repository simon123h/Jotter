"""Periodic vault maintenance: re-index changed Markdown files and commit changes to Git.

One background thread wakes up every minute. It reconciles the SQLite index with the task files on disk (files
whose size and mtime are unchanged are not read again) and, if anything changed since the last commit, commits the
vault. There is no filesystem watcher: external edits (editors, Syncthing, `git pull`) show up within a minute.
"""

import json
import logging
import threading
import time
from collections.abc import Callable
from pathlib import Path

logger = logging.getLogger(__name__)

SYNC_INTERVAL_SECONDS = 60.0

# Every Nth cycle checks Git even if nothing was seen to change, to pick up edits the index does not track
# (settings, attachments, canvases, files delivered by a sync tool)
VERIFY_COMMIT_EVERY_CYCLES = 10

# Steps slower than this are logged as warnings (slow disks and antivirus on Windows)
SLOW_STEP_SECONDS = 1.0

SyncFn = Callable[[Path], bool]
CommitFn = Callable[[Path], bool]


def sync_vault(data_dir: Path) -> bool:
    """Default sync function: reconciles the index. Returns True if any task file was re-read or removed."""
    from jotter.features.sync.service import SyncApplicationService
    from jotter.shared.db import create_sqlite_connection

    conn = create_sqlite_connection(data_dir / "tasks.db")
    try:
        svc = SyncApplicationService.from_data_dir(data_dir, conn)
        svc.sync_db_only()
        return svc.last_changes > 0
    finally:
        conn.close()


def _auto_commit_enabled(data_dir: Path) -> bool:
    """Reads the `autoCommit` setting without creating settings.json (that would itself be an uncommitted change)."""
    try:
        return bool(json.loads((data_dir / "settings.json").read_text(encoding="utf-8")).get("autoCommit", True))
    except (OSError, ValueError, AttributeError):
        return True


def commit_vault(data_dir: Path) -> bool:
    """Default commit function: commits the vault and its project folders. Returns True if a commit was created."""
    from jotter.features.sync.service import SyncApplicationService
    from jotter.shared.db import create_sqlite_connection

    if not _auto_commit_enabled(data_dir):
        return False

    conn = create_sqlite_connection(data_dir / "tasks.db")
    try:
        return SyncApplicationService.from_data_dir(data_dir, conn).commit_changes()
    finally:
        conn.close()


class VaultSyncScheduler:
    def __init__(
        self,
        data_dir: Path | str,
        sync_fn: SyncFn = sync_vault,
        commit_fn: CommitFn = commit_vault,
        interval_seconds: float = SYNC_INTERVAL_SECONDS,
        verify_every: int = VERIFY_COMMIT_EVERY_CYCLES,
    ):
        self.data_dir = Path(data_dir)
        self._sync_fn = sync_fn
        self._commit_fn = commit_fn
        self._interval = interval_seconds
        self._verify_every = verify_every
        self._lock = threading.Lock()
        self._run_lock = threading.Lock()  # serializes cycles, flushes and retargeting
        self._stop_event = threading.Event()
        self._thread: threading.Thread | None = None
        self._dirty = False
        self._cycles = 0

    def start(self) -> None:
        if self._thread is not None:
            return
        self._thread = threading.Thread(target=self._loop, name="jotter-vault-sync", daemon=True)
        self._thread.start()

    def mark_dirty(self) -> None:
        """Records that vault data changed through Jotter itself, so the next cycle commits."""
        with self._lock:
            self._dirty = True

    def _loop(self) -> None:
        while not self._stop_event.wait(self._interval):
            self.run_once()

    def run_once(self) -> None:
        """One maintenance cycle: reconcile the index, then commit if something changed."""
        with self._run_lock:
            data_dir = self.data_dir
            started = time.perf_counter()
            try:
                if self._sync_fn(data_dir):
                    self.mark_dirty()
            except Exception as e:
                logger.warning("Periodic sync failed for %s: %s", data_dir, e)
            self._log_step("Periodic sync", data_dir, started)

            self._cycles += 1
            if self._is_dirty() or self._cycles % self._verify_every == 0:
                self._commit(data_dir)

    def _is_dirty(self) -> bool:
        with self._lock:
            return self._dirty

    def _commit(self, data_dir: Path) -> None:
        with self._lock:
            self._dirty = False
        started = time.perf_counter()
        try:
            self._commit_fn(data_dir)
        except Exception as e:
            logger.warning("Auto-commit failed for %s: %s", data_dir, e)
            self.mark_dirty()
        self._log_step("Auto-commit", data_dir, started)

    @staticmethod
    def _log_step(step: str, data_dir: Path, started: float) -> None:
        elapsed = time.perf_counter() - started
        log = logger.warning if elapsed > SLOW_STEP_SECONDS else logger.debug
        log("%s of %s took %.2fs", step, data_dir, elapsed)

    def flush(self) -> None:
        """Commits pending changes now (shutdown, vault switch)."""
        with self._run_lock:
            if self._is_dirty():
                self._commit(self.data_dir)

    def retarget(self, data_dir: Path | str) -> None:
        """Follows a new vault. Changes still pending in the old one stay uncommitted until it is opened again.

        Committing here would make a vault switch wait for Git (slow under antivirus on Windows) and for a cycle that
        is already running, which keeps working on the vault it started with. The new vault starts dirty so its first
        cycle checks Git for changes that arrived while it was inactive (including the old vault's, after a return).
        """
        with self._lock:
            self.data_dir = Path(data_dir)
            self._dirty = True
            self._cycles = 0

    def stop(self) -> None:
        self._stop_event.set()
        if self._thread is not None:
            self._thread.join(timeout=5.0)
        self.flush()
