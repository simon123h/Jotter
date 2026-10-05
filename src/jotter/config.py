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
    vaults_config_path: str | None = None


def get_config_dir() -> Path:
    """The folder for jotter.yaml and vaults.json."""
    if sys.platform.startswith("linux"):
        xdg_config = os.environ.get("XDG_CONFIG_HOME")
        return (Path(xdg_config) if xdg_config else Path.home() / ".config") / "jotter"
    if sys.platform == "darwin":
        return Path.home() / "Library" / "Application Support" / "jotter"
    if sys.platform == "win32":
        appdata = os.environ.get("APPDATA")
        return (Path(appdata) if appdata else Path.home() / "AppData" / "Roaming") / "jotter"
    return Path.home() / ".jotter"


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
    # Windows and macOS ignore letter case, so the data folder cannot be a sibling named "Jotter" of the config
    # folder "jotter": it would be the same folder, and vaults.json would end up inside the vault. It lives in it.
    return str((get_config_dir() / "tasks").resolve())


def get_default_config_paths() -> list[Path]:
    cwd = Path.cwd()

    # Portable configs in CWD, then the global config of the OS
    return [cwd / "jotter.yaml", cwd / "jotter.yml", cwd / "jotter.json", get_config_dir() / "jotter.yaml"]


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
                            logger.warning(
                                "Ignoring 'data_dir' in %s: it is no longer supported. Manage vaults in the app instead.",
                                path,
                            )
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
                break
            except Exception as e:
                logger.warning("Failed to read config from %s: %s", path, e)

    # Environment variables override
    if os.environ.get("JOTTER_DATA_DIR"):
        logger.warning("Ignoring JOTTER_DATA_DIR: it is no longer supported. Manage vaults in the app instead.")
    if os.environ.get("JOTTER_PORT"):
        try:
            config.port = int(os.environ["JOTTER_PORT"])
        except ValueError:
            pass
    if os.environ.get("JOTTER_HOST"):
        config.host = os.environ["JOTTER_HOST"]
    if os.environ.get("JOTTER_LOG_DIR"):
        config.log_dir = str(Path(os.environ["JOTTER_LOG_DIR"]).expanduser().resolve())
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


def save_user_config(config: UserConfig, target_path: Path | None = None) -> Path:
    """Saves UserConfig to a YAML configuration file."""
    if target_path is None:
        # If an existing config exists, use it; otherwise use the primary default config path
        for p in get_default_config_paths():
            if p.is_file():
                target_path = p
                break
        if target_path is None:
            default_paths = get_default_config_paths()
            target_path = default_paths[0] if default_paths else (Path.home() / ".jotter" / "jotter.yaml")

    target_path.parent.mkdir(parents=True, exist_ok=True)

    # Read existing content if available to preserve extra fields
    existing_data: dict = {}
    if target_path.is_file():
        try:
            with open(target_path, encoding="utf-8") as f:
                loaded = yaml.safe_load(f)
                if isinstance(loaded, dict):
                    existing_data = loaded
        except Exception:
            existing_data = {}

    existing_data.pop("data_dir", None)  # legacy key, vaults.json is the source of truth
    existing_data["host"] = config.host
    existing_data["port"] = config.port
    existing_data["log_level"] = config.log_level

    with open(target_path, "w", encoding="utf-8") as f:
        yaml.safe_dump(existing_data, f, default_flow_style=False)

    return target_path
