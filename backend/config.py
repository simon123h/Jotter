import os
import sys
from pathlib import Path

import yaml
from pydantic import BaseModel


class UserConfig(BaseModel):
    data_dir: str = ""
    log_dir: str = ""
    host: str = "127.0.0.1"
    port: int = 58271
    log_level: str = "INFO"
    open_browser: bool = True


def get_default_data_dir() -> str:
    # 1. Portable Mode: check if "tasks" directory exists in current working directory
    cwd = Path.cwd()
    local_tasks = cwd / "tasks"
    if local_tasks.is_dir():
        return str(local_tasks.resolve())

    # 2. Resolve OS-Specific Paths
    home = Path.home()
    if sys.platform == "win32":
        app_data = os.environ.get("APPDATA")
        base = Path(app_data) if app_data else home / "AppData" / "Roaming"
        return str((base / "Jotter").resolve())
    elif sys.platform == "darwin":
        return str((home / "Library" / "Application Support" / "Jotter").resolve())
    else:  # Linux / Unix
        xdg_data = os.environ.get("XDG_DATA_HOME")
        base = Path(xdg_data) if xdg_data else home / ".local" / "share"
        return str((base / "jotter").resolve())


def get_default_config_paths() -> list[Path]:
    paths: list[Path] = []
    cwd = Path.cwd()

    # Portable search
    for directory in [cwd, cwd.parent]:
        for filename in ["jotter.yaml", "jotter.yml", "jotter.json"]:
            paths.append(directory / filename)

    # OS-Specific config search
    home = Path.home()
    if sys.platform == "win32":
        app_data = os.environ.get("APPDATA")
        base = (Path(app_data) if app_data else home / "AppData" / "Roaming") / "Jotter"
    elif sys.platform == "darwin":
        base = home / "Library" / "Application Support" / "Jotter"
    else:
        xdg_config = os.environ.get("XDG_CONFIG_HOME")
        base = (Path(xdg_config) if xdg_config else home / ".config") / "jotter"

    for filename in ["config.yaml", "config.yml", "config.json", "jotter.yaml", "jotter.yml", "jotter.json"]:
        paths.append(base / filename)

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
                            config.log_level = data["log_level"]
                break
            except Exception as e:
                print(f"[Config] Warning: Failed to read config from {path}: {e}")

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
        config.log_level = os.environ["JOTTER_LOG_LEVEL"]

    # Ensure data directory exists
    Path(config.data_dir).mkdir(parents=True, exist_ok=True)
    return config
