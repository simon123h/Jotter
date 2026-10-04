"""Smart auto-commit: commits vault changes to Git shortly after they happen, rate-limited by a cooldown.

Every data-changing interaction calls `mark_dirty()`. The scheduler turns that into at most one commit per cooldown
window: the first change commits after a short debounce (so bursts settle), changes made during the cooldown are
coalesced into one trailing commit at its end.
"""

import logging
import threading
import time
from collections.abc import Callable
from pathlib import Path

logger = logging.getLogger(__name__)

AUTO_COMMIT_COOLDOWN_SECONDS = 60.0
AUTO_COMMIT_DEBOUNCE_SECONDS = 3.0

CommitFn = Callable[[Path], bool]
TimerFactory = Callable[[float, Callable[[], None]], threading.Timer]


def commit_vault(data_dir: Path) -> bool:
    """Default commit function: commits the vault and its project folders. Returns True if a commit was created."""
    from jotter.features.sync.service import SyncApplicationService
    from jotter.shared.db import create_sqlite_connection

    conn = create_sqlite_connection(data_dir / "tasks.db")
    try:
        return SyncApplicationService.from_data_dir(data_dir, conn).commit_changes()
    finally:
        conn.close()


def _start_timer(delay: float, fn: Callable[[], None]) -> threading.Timer:
    timer = threading.Timer(delay, fn)
    timer.daemon = True
    timer.start()
    return timer


class AutoCommitScheduler:
    def __init__(
        self,
        data_dir: Path | str,
        commit_fn: CommitFn = commit_vault,
        cooldown_seconds: float = AUTO_COMMIT_COOLDOWN_SECONDS,
        debounce_seconds: float = AUTO_COMMIT_DEBOUNCE_SECONDS,
        clock: Callable[[], float] = time.monotonic,
        timer_factory: TimerFactory = _start_timer,
    ):
        self.data_dir = Path(data_dir)
        self._commit_fn = commit_fn
        self._cooldown = cooldown_seconds
        self._debounce = debounce_seconds
        self._clock = clock
        self._timer_factory = timer_factory
        self._lock = threading.Lock()
        self._commit_lock = threading.Lock()
        self._timer: threading.Timer | None = None
        self._dirty = False
        self._stopped = False
        self._last_commit_at: float | None = None

    def mark_dirty(self) -> None:
        """Records that vault data changed; schedules a commit unless one is already pending."""
        with self._lock:
            if self._stopped:
                return
            self._dirty = True
            if self._timer is not None:
                return
            delay = self._debounce
            if self._last_commit_at is not None:
                delay = max(delay, self._last_commit_at + self._cooldown - self._clock())
            self._timer = self._timer_factory(delay, self._fire)

    def _fire(self) -> None:
        with self._lock:
            self._timer = None
            if self._stopped or not self._dirty:
                return
        self._commit_now()

    def _commit_now(self) -> None:
        with self._commit_lock:
            with self._lock:
                if not self._dirty:
                    return
                self._dirty = False
                previous = self._last_commit_at
                # Claim the cooldown up front so changes arriving during the commit wait it out
                self._last_commit_at = self._clock()
            committed = False
            try:
                committed = self._commit_fn(self.data_dir)
            except Exception as e:
                logger.warning("Auto-commit failed for %s: %s", self.data_dir, e)
            if not committed:
                with self._lock:
                    self._last_commit_at = previous

    def flush(self) -> None:
        """Commits pending changes immediately, ignoring the cooldown (shutdown, vault switch)."""
        with self._lock:
            if self._timer is not None:
                self._timer.cancel()
                self._timer = None
        self._commit_now()

    def retarget(self, data_dir: Path | str) -> None:
        """Flushes pending changes of the current vault, then follows a new one."""
        self.flush()
        with self._lock:
            self.data_dir = Path(data_dir)
            self._last_commit_at = None

    def stop(self) -> None:
        self.flush()
        with self._lock:
            self._stopped = True
