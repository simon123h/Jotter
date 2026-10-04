"""Filesystem utility functions including cross-platform atomic file operations."""

import logging
import os
import shutil
import tempfile
import threading
import time
from pathlib import Path

logger = logging.getLogger(__name__)


def atomic_replace(src: Path | str, dst: Path | str, max_retries: int = 6, initial_delay: float = 0.02) -> None:
    """Atomically replaces dst with src, handling transient Windows file lock collisions.

    On Windows, `os.replace` can fail with PermissionError / WinError 5 if the destination file
    is momentarily opened by another process (indexer, antivirus, concurrent reader) or if
    file handles have not been released immediately. This retries with exponential backoff,
    and falls back to shutil.copy2 + unlink if replacement keeps failing.
    """
    src_path = Path(src)
    dst_path = Path(dst)

    for attempt in range(max_retries):
        try:
            src_path.replace(dst_path)
            return
        except PermissionError as e:
            if attempt == max_retries - 1:
                # Last resort fallback: copy over and remove source
                try:
                    shutil.copy2(src_path, dst_path)
                    try:
                        src_path.unlink(missing_ok=True)
                    except Exception:
                        pass
                    return
                except Exception:
                    logger.warning(
                        "Failed atomic_replace from %s to %s after %d retries: %s", src_path, dst_path, max_retries, e
                    )
                    raise
            time.sleep(initial_delay * (2**attempt))
        except OSError:
            # Handle other transient OS errors (e.g. sharing violations)
            if attempt == max_retries - 1:
                raise
            time.sleep(initial_delay * (2**attempt))


_recent_self_writes: dict[str, float] = {}
_recent_writes_lock = threading.Lock()


def register_recent_self_write(path: Path | str, ttl_seconds: float = 2.0) -> None:
    """Records a path written by Jotter itself to suppress redundant watcher echo events."""
    norm = str(Path(path).resolve()).replace("\\", "/").lower()
    now = time.time()
    with _recent_writes_lock:
        # Prune stale entries older than 10 seconds
        global _recent_self_writes
        _recent_self_writes = {p: ts for p, ts in _recent_self_writes.items() if now - ts < 10.0}
        _recent_self_writes[norm] = now + ttl_seconds


def is_recent_self_write(path_str: str) -> bool:
    """Checks whether a path was modified by Jotter within its suppression TTL."""
    norm = str(Path(path_str).resolve()).replace("\\", "/").lower()
    now = time.time()
    with _recent_writes_lock:
        expiry = _recent_self_writes.get(norm)
        if expiry and now < expiry:
            return True
    return False


def atomic_write(
    target_path: Path | str, content: str, encoding: str = "utf-8", prefix: str = ".tmp_", suffix: str = ".tmp"
) -> None:
    """Safely and atomically writes string content to a target file via a temporary file."""
    path = Path(target_path)
    parent_dir = path.parent
    parent_dir.mkdir(parents=True, exist_ok=True)

    # Automatically register self write
    register_recent_self_write(path)

    with tempfile.NamedTemporaryFile(
        "w", dir=parent_dir, delete=False, encoding=encoding, prefix=prefix, suffix=suffix
    ) as f:
        f.write(content)
        f.flush()
        os.fsync(f.fileno())
        tmp_name = f.name

    atomic_replace(Path(tmp_name), path)
