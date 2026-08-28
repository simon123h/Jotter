import logging
import os
import sys
from pathlib import Path

import yaml
from pydantic import BaseModel

logger = logging.getLogger(__name__)

VALID_LOG_LEVELS: dict[str, str] = {
    "debug": "DEBUG",
    "info": "INFO",
    "warn": "WARNING",
    "warning": "WARNING",
    "error": "ERROR",
    "err": "ERROR",
    "critical": "CRITICAL",
    "fatal": "CRITICAL",
    "trace": "TRACE",
}


def normalize_log_level(level: str | None) -> str:
    if not level:
        return "INFO"
    clean = str(level).strip().lower()
    if clean in VALID_LOG_LEVELS:
        return VALID_LOG_LEVELS[clean]
    logger.warning("Unknown log_level '%s', falling back to 'INFO'", level)
    return "INFO"


class UserConfig(BaseModel):
    data_dir: str = ""
    log_dir: str = ""
    host: str = "127.0.0.1"
    port: int = 58271
    log_level: str = "INFO"
    open_browser: bool = True
    use_colors: bool | None = None


def get_default_data_dir() -> str:
    # 1. Portable Mode: check if "tasks" directory exists in current working directory
    cwd = Path.cwd()
    local_tasks = cwd / "tasks"
    if local_tasks.is_dir():
        return str(local_tasks.resolve())

    # 2. Global / Installed Mode based on OS
    if sys.platform.startswith("linux"):
        xdg_data = os.environ.get("XDG_DATA_HOME")
        if xdg_data:
            return str((Path(xdg_data) / "jotter").resolve())
        return str((Path.home() / ".local" / "share" / "jotter").resolve())
    elif sys.platform == "darwin":
        return str((Path.home() / "Library" / "Application Support" / "Jotter").resolve())
    elif sys.platform == "win32":
        appdata = os.environ.get("APPDATA")
        if appdata:
            return str((Path(appdata) / "Jotter").resolve())
        return str((Path.home() / "AppData" / "Roaming" / "Jotter").resolve())
    else:
        return str((Path.home() / ".jotter").resolve())


def get_default_config_paths() -> list[Path]:
    paths: list[Path] = []
    cwd = Path.cwd()

    # Portable configs in CWD
    paths.append(cwd / "jotter.yaml")
    paths.append(cwd / "jotter.yml")
    paths.append(cwd / "jotter.json")

    # Global configs based on OS
    if sys.platform.startswith("linux"):
        xdg_config = os.environ.get("XDG_CONFIG_HOME")
        if xdg_config:
            paths.append(Path(xdg_config) / "jotter" / "jotter.yaml")
        else:
            paths.append(Path.home() / ".config" / "jotter" / "jotter.yaml")
    elif sys.platform == "darwin":
        paths.append(Path.home() / "Library" / "Application Support" / "jotter" / "jotter.yaml")
    elif sys.platform == "win32":
        appdata = os.environ.get("APPDATA")
        if appdata:
            paths.append(Path(appdata) / "jotter" / "jotter.yaml")
        else:
            paths.append(Path.home() / "AppData" / "Roaming" / "jotter" / "jotter.yaml")

    return paths


def load_config() -> UserConfig:
    config = UserConfig()
    config.data_dir = get_default_data_dir()

    # Search for config file
    for path in get_default_config_paths():
        if path.is_file():
            try:
                with open(path, encoding="utf-8") as f:
                    data = yaml.safe_load(f)
                    if isinstance(data, dict):
                        if data.get("data_dir"):
                            config.data_dir = str(Path(data["data_dir"]).expanduser().resolve())
                        if data.get("log_dir"):
                            config.log_dir = str(Path(data["log_dir"]).expanduser().resolve())
                        if data.get("host"):
                            config.host = data["host"]
                        if data.get("port"):
                            config.port = int(data["port"])
                        if data.get("log_level"):
                            config.log_level = normalize_log_level(data["log_level"])
                        if "use_colors" in data:
                            config.use_colors = bool(data["use_colors"])
                        elif "colors" in data:
                            config.use_colors = bool(data["colors"])
                break
            except Exception as e:
                logger.warning("Failed to read config from %s: %s", path, e)

    # Environment variables override
    if os.environ.get("JOTTER_DATA_DIR"):
        config.data_dir = str(Path(os.environ["JOTTER_DATA_DIR"]).expanduser().resolve())
    if os.environ.get("JOTTER_PORT"):
        try:
            config.port = int(os.environ["JOTTER_PORT"])
        except ValueError:
            pass
    if os.environ.get("JOTTER_HOST"):
        config.host = os.environ["JOTTER_HOST"]
    if os.environ.get("JOTTER_LOG_LEVEL"):
        config.log_level = normalize_log_level(os.environ["JOTTER_LOG_LEVEL"])

    # Standard NO_COLOR specification (https://no-color.org) and JOTTER_USE_COLORS
    if os.environ.get("NO_COLOR"):
        config.use_colors = False
    elif os.environ.get("JOTTER_USE_COLORS") is not None:
        val = os.environ.get("JOTTER_USE_COLORS", "").strip().lower()
        config.use_colors = val not in ("0", "false", "no", "off")

    # Final normalization
    config.log_level = normalize_log_level(config.log_level)

    # Ensure data directory exists
    Path(config.data_dir).mkdir(parents=True, exist_ok=True)
    return config
