import os
from pathlib import Path
from unittest.mock import patch

import pytest

from jotter.config import (
    get_config_dir,
    get_default_config_paths,
    get_default_data_dir,
    load_config,
    normalize_log_level,
)


def test_log_level_normalization():
    assert normalize_log_level("WARN") == "WARNING"
    assert normalize_log_level("warn") == "WARNING"
    assert normalize_log_level("warning") == "WARNING"
    assert normalize_log_level("ERR") == "ERROR"
    assert normalize_log_level("error") == "ERROR"
    assert normalize_log_level("debug") == "DEBUG"
    assert normalize_log_level("info") == "INFO"
    assert normalize_log_level("FATAL") == "CRITICAL"
    assert normalize_log_level("trace") == "TRACE"
    assert normalize_log_level("non_existent") == "INFO"
    assert normalize_log_level(None) == "INFO"


def test_portable_mode_detection(tmp_path):
    tasks_dir = tmp_path / "tasks"
    tasks_dir.mkdir()

    with patch("pathlib.Path.cwd", return_value=tmp_path):
        resolved = get_default_data_dir()
        assert resolved == str(tasks_dir.resolve())


def test_os_specific_data_dir_resolution(tmp_path):
    with patch("pathlib.Path.cwd", return_value=tmp_path):
        with patch.dict(os.environ, {"XDG_DATA_HOME": str(tmp_path / "xdg_data")}, clear=True):
            resolved = get_default_data_dir()
            assert resolved == str((tmp_path / "xdg_data" / "jotter").resolve())


def test_config_paths_discovery(tmp_path):
    with patch("pathlib.Path.cwd", return_value=tmp_path):
        with patch("pathlib.Path.home", return_value=tmp_path):
            paths = get_default_config_paths()
            assert len(paths) > 0
            assert any(p.name == "jotter.yaml" for p in paths)


def test_load_config_with_file(tmp_path):
    config_file = tmp_path / "jotter.yaml"
    config_file.write_text(
        """
host: 0.0.0.0
port: 9090
log_level: warn
""",
        encoding="utf-8",
    )

    with patch("jotter.config.get_default_config_paths", return_value=[config_file]):
        cfg = load_config()
        assert cfg.host == "0.0.0.0"
        assert cfg.port == 9090
        assert cfg.log_level == "WARNING"


def test_legacy_data_dir_settings_are_ignored(tmp_path):
    config_file = tmp_path / "jotter.yaml"
    config_file.write_text(f"data_dir: {tmp_path / 'from_yaml'}\n", encoding="utf-8")

    with (
        patch("jotter.config.get_default_config_paths", return_value=[config_file]),
        patch.dict(os.environ, {"JOTTER_DATA_DIR": str(tmp_path / "from_env")}),
    ):
        cfg = load_config()
        assert cfg.data_dir == get_default_data_dir()


def test_load_config_env_overrides(tmp_path):
    env = {
        "JOTTER_HOST": "127.0.0.2",
        "JOTTER_PORT": "6000",
        "JOTTER_LOG_LEVEL": "debug",
    }
    with patch.dict(os.environ, env, clear=True):
        cfg = load_config()
        assert cfg.host == "127.0.0.2"
        assert cfg.port == 6000
        assert cfg.log_level == "DEBUG"


def test_load_config_with_colors_setting(tmp_path):
    config_file = tmp_path / "jotter.yaml"
    config_file.write_text("use_colors: false\n", encoding="utf-8")

    with patch("jotter.config.get_default_config_paths", return_value=[config_file]):
        cfg = load_config()
        assert cfg.use_colors is False


def test_no_color_environment_variable(tmp_path):
    with patch.dict(os.environ, {"NO_COLOR": "1"}, clear=True):
        cfg = load_config()
        assert cfg.use_colors is False

    with patch.dict(os.environ, {"JOTTER_USE_COLORS": "0"}, clear=True):
        cfg = load_config()
        assert cfg.use_colors is False

    with patch.dict(os.environ, {"JOTTER_USE_COLORS": "1"}, clear=True):
        cfg = load_config()
        assert cfg.use_colors is True


def test_module_execution_main():
    import jotter.__main__ as jmain

    assert hasattr(jmain, "main")


@pytest.mark.parametrize("platform", ["win32", "darwin", "linux"])
def test_default_data_dir_is_never_the_config_dir(tmp_path, platform):
    # Windows and macOS ignore case, so the two folders must not be siblings that differ only in case
    env = {"APPDATA": str(tmp_path / "appdata"), "XDG_CONFIG_HOME": str(tmp_path / "cfg")}
    with (
        patch("jotter.config.sys.platform", platform),
        patch("pathlib.Path.cwd", return_value=tmp_path),
        patch("pathlib.Path.home", return_value=tmp_path),
        patch.dict(os.environ, env, clear=True),
    ):
        config_dir = get_config_dir().resolve()
        data_dir = Path(get_default_data_dir())
        assert str(config_dir).lower() != str(data_dir).lower()
        if platform != "linux":
            assert data_dir == config_dir / "tasks"
