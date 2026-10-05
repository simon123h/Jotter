import logging
import sys
from pathlib import Path

import pytest

from jotter.config import UserConfig
from jotter.logging_setup import LOG_FILE_NAME, MAX_LOG_FILE_BYTES, configure_logging, get_default_log_dir


@pytest.fixture(autouse=True)
def reset_jotter_logger():
    logger = logging.getLogger("jotter")
    saved = (logger.level, logger.propagate)
    yield
    for handler in list(logger.handlers):
        logger.removeHandler(handler)
        handler.close()
    logger.setLevel(saved[0])
    logger.propagate = saved[1]


def _flush():
    for handler in logging.getLogger("jotter").handlers:
        handler.flush()


def test_log_level_applies_to_jotter_loggers_and_file(temp_dir):
    log_file = configure_logging(UserConfig(data_dir=temp_dir, log_dir=temp_dir, log_level="DEBUG"))
    assert log_file == Path(temp_dir) / LOG_FILE_NAME

    logging.getLogger("jotter.features.sync.auto_commit").debug("debug-message")
    _flush()
    assert "debug-message" in log_file.read_text(encoding="utf-8")

    configure_logging(UserConfig(data_dir=temp_dir, log_dir=temp_dir, log_level="WARNING"))
    logging.getLogger("jotter.x").info("info-hidden")
    logging.getLogger("jotter.x").warning("warning-shown")
    _flush()
    text = log_file.read_text(encoding="utf-8")
    assert "info-hidden" not in text
    assert "warning-shown" in text


def test_configure_logging_is_idempotent(temp_dir):
    config = UserConfig(data_dir=temp_dir, log_dir=temp_dir, log_level="INFO")
    configure_logging(config)
    configure_logging(config)
    assert len(logging.getLogger("jotter").handlers) == 2  # console + file, not duplicated


def test_oversized_log_file_is_replaced_on_startup(temp_dir):
    log_file = Path(temp_dir) / LOG_FILE_NAME
    log_file.write_bytes(b"x" * (MAX_LOG_FILE_BYTES + 1))
    configure_logging(UserConfig(data_dir=temp_dir, log_dir=temp_dir, log_level="INFO"))
    assert log_file.stat().st_size < MAX_LOG_FILE_BYTES


def test_unwritable_log_dir_falls_back_to_console_only(temp_dir):
    blocker = Path(temp_dir) / "file"
    blocker.write_text("not a directory", encoding="utf-8")
    assert configure_logging(UserConfig(data_dir=temp_dir, log_dir=str(blocker / "logs"), log_level="INFO")) is None
    assert len(logging.getLogger("jotter").handlers) == 1


def test_default_log_dir_is_outside_the_vault(monkeypatch, temp_dir):
    monkeypatch.setattr(sys, "platform", "linux")
    monkeypatch.setenv("XDG_CACHE_HOME", temp_dir)
    assert get_default_log_dir() == Path(temp_dir) / "jotter"
    monkeypatch.setattr(sys, "platform", "win32")
    monkeypatch.setenv("LOCALAPPDATA", temp_dir)
    assert get_default_log_dir() == Path(temp_dir) / "Jotter"
