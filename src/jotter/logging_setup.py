"""Logging setup: Jotter's own loggers write to the console and to a `jotter.log` file."""

import logging
import os
import sys
from pathlib import Path

from jotter.config import UserConfig

LOG_FILE_NAME = "jotter.log"
MAX_LOG_FILE_BYTES = 5 * 1024 * 1024
LOG_FORMAT = "%(asctime)s %(levelname)s %(name)s: %(message)s"

logger = logging.getLogger("jotter")


def get_default_log_dir() -> Path:
    """OS-specific log directory, kept outside the data directory so logs are never committed to the vault."""
    if sys.platform == "win32":
        base = os.environ.get("LOCALAPPDATA")
        return Path(base) / "Jotter" if base else Path.home() / "AppData" / "Local" / "Jotter"
    if sys.platform == "darwin":
        return Path.home() / "Library" / "Logs" / "Jotter"
    xdg_cache = os.environ.get("XDG_CACHE_HOME")
    return (Path(xdg_cache) if xdg_cache else Path.home() / ".cache") / "jotter"


def configure_logging(config: UserConfig) -> Path | None:
    """Routes the `jotter.*` loggers to stderr and the log file at the configured level.

    Returns the log file path, or None if the file could not be opened (console logging still works).
    Uvicorn only configures its own loggers, so without this Jotter's INFO and DEBUG messages are dropped.
    """
    level = logging.DEBUG if config.log_level == "TRACE" else logging.getLevelName(config.log_level)
    logger.setLevel(level if isinstance(level, int) else logging.INFO)
    logger.propagate = False
    for handler in list(logger.handlers):
        logger.removeHandler(handler)
        handler.close()

    formatter = logging.Formatter(LOG_FORMAT)
    console = logging.StreamHandler()
    console.setFormatter(formatter)
    logger.addHandler(console)

    log_path = Path(config.log_dir) / LOG_FILE_NAME if config.log_dir else get_default_log_dir() / LOG_FILE_NAME
    try:
        log_path.parent.mkdir(parents=True, exist_ok=True)
        try:
            if log_path.is_file() and log_path.stat().st_size > MAX_LOG_FILE_BYTES:
                log_path.unlink()
        except OSError:
            pass  # e.g. another instance holds it open on Windows: keep appending instead of losing the log
        file_handler = logging.FileHandler(log_path, encoding="utf-8")
        file_handler.setFormatter(formatter)
        logger.addHandler(file_handler)
    except OSError as e:
        logger.warning("Could not open log file %s: %s", log_path, e)
        return None
    return log_path
