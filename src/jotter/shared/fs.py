"""Filesystem utility functions including cross-platform atomic file operations."""

import logging
import os
import shutil
import tempfile
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


def atomic_write(
    target_path: Path | str, content: str, encoding: str = "utf-8", prefix: str = ".tmp_", suffix: str = ".tmp"
) -> None:
    """Safely and atomically writes string content to a target file via a temporary file."""
    path = Path(target_path)
    parent_dir = path.parent
    parent_dir.mkdir(parents=True, exist_ok=True)

    with tempfile.NamedTemporaryFile(
        "w", dir=parent_dir, delete=False, encoding=encoding, prefix=prefix, suffix=suffix
    ) as f:
        f.write(content)
        f.flush()
        os.fsync(f.fileno())
        tmp_name = f.name

    atomic_replace(Path(tmp_name), path)
