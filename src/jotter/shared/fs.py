"""Filesystem utility functions including cross-platform atomic file operations."""

import contextlib
import logging
import os
import shutil
import tempfile
import time
from pathlib import Path

logger = logging.getLogger(__name__)

# Writes slower than this are logged as warnings (slow disks and antivirus on Windows)
SLOW_WRITE_SECONDS = 0.2


def atomic_replace(src: Path | str, dst: Path | str, max_retries: int = 6, initial_delay: float = 0.02) -> None:
    """Atomically replaces dst with src, handling transient Windows file lock collisions.

    On Windows, `os.replace` can fail with PermissionError / WinError 5 if the destination file
    is momentarily opened by another process (indexer, antivirus, concurrent reader) or if
    file handles have not been released immediately. This retries with exponential backoff,
    and falls back to shutil.copy2 + unlink if replacement keeps failing.
    """
    src_path = Path(src)
    dst_path = Path(dst)

    started = time.perf_counter()
    for attempt in range(max_retries):
        try:
            src_path.replace(dst_path)
            if attempt:
                logger.warning(
                    "atomic_replace of %s succeeded after %d retries (%.2fs): file was locked",
                    dst_path,
                    attempt,
                    time.perf_counter() - started,
                )
            return
        except PermissionError as e:
            if attempt == max_retries - 1:
                # Last resort fallback: copy over and remove source
                try:
                    shutil.copy2(src_path, dst_path)
                    with contextlib.suppress(Exception):
                        src_path.unlink(missing_ok=True)
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


def atomic_write(
    target_path: Path | str, content: str, encoding: str = "utf-8", prefix: str = ".tmp_", suffix: str = ".tmp"
) -> None:
    """Safely and atomically writes string content to a target file via a temporary file."""
    path = Path(target_path)
    parent_dir = path.parent
    parent_dir.mkdir(parents=True, exist_ok=True)

    started = time.perf_counter()
    with tempfile.NamedTemporaryFile(
        "w", dir=parent_dir, delete=False, encoding=encoding, prefix=prefix, suffix=suffix
    ) as f:
        f.write(content)
        f.flush()
        flush_started = time.perf_counter()
        os.fsync(f.fileno())
        fsync_seconds = time.perf_counter() - flush_started
        tmp_name = f.name
    closed = time.perf_counter()

    atomic_replace(Path(tmp_name), path)

    total = time.perf_counter() - started
    if total > SLOW_WRITE_SECONDS:
        logger.warning(
            "Slow write of %s: %.2fs (%.2fs fsync, %.2fs creating and closing the temp file, %.2fs replacing)",
            path,
            total,
            fsync_seconds,
            closed - started - fsync_seconds,
            time.perf_counter() - closed,
        )
