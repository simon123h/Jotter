import os
from unittest.mock import patch

from jotter.config import (
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
    custom_data = tmp_path / "custom_data"
    config_file.write_text(
        f"""
host: 0.0.0.0
port: 9090
log_level: warn
data_dir: {custom_data}
""",
        encoding="utf-8",
    )

    with patch("jotter.config.get_default_config_paths", return_value=[config_file]):
        cfg = load_config()
        assert cfg.host == "0.0.0.0"
        assert cfg.port == 9090
        assert cfg.log_level == "WARNING"
        assert cfg.data_dir == str(custom_data.resolve())


def test_load_config_env_overrides(tmp_path):
    env = {
        "JOTTER_HOST": "127.0.0.2",
        "JOTTER_PORT": "6000",
        "JOTTER_LOG_LEVEL": "debug",
        "JOTTER_DATA_DIR": str(tmp_path / "env_data"),
    }
    with patch.dict(os.environ, env, clear=True):
        cfg = load_config()
        assert cfg.host == "127.0.0.2"
        assert cfg.port == 6000
        assert cfg.log_level == "DEBUG"
        assert cfg.data_dir == str((tmp_path / "env_data").resolve())


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
