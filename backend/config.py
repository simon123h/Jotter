import os
import sys
from pathlib import Path
from typing import Optional

import yaml

_config: Optional[dict] = None

# Centralized check for production (packaged) execution
IS_PRODUCTION = getattr(sys, "frozen", False)


def load_yaml_config(path: Path) -> dict:
    try:
        with open(path, "r", encoding="utf-8") as f:
            data = yaml.safe_load(f)
            if isinstance(data, dict):
                return data
    except Exception:
        pass
    return {}


def _get_config() -> dict:
    global _config
    if _config is not None:
        return _config

    _config = {}
    # Search in:
    # - current working directory
    # - parent of current working directory
    # - project root (parent of backend folder)
    search_dirs = [
        Path.cwd(),
        Path.cwd().parent,
        Path(__file__).resolve().parent.parent,
    ]

    # De-duplicate paths while preserving order
    seen = set()
    unique_search_dirs = []
    for d in search_dirs:
        try:
            resolved = d.resolve()
            if resolved not in seen:
                seen.add(resolved)
                unique_search_dirs.append(resolved)
        except Exception:
            pass

    for d in unique_search_dirs:
        for filename in ("jotter.yaml", "jotter.yml", "jotter.json"):
            config_path = d / filename
            if config_path.exists() and config_path.is_file():
                _config = load_yaml_config(config_path)
                return _config

    return _config


def get_data_dir() -> Optional[str]:
    # 1. Environment Variable JOTTER_DATA_DIR
    data_dir = os.environ.get("JOTTER_DATA_DIR")
    if data_dir:
        return os.path.abspath(os.path.expanduser(data_dir))

    # 2. Config File
    config = _get_config()
    data_dir_val = config.get("data_dir") or config.get("data-dir")
    if data_dir_val:
        return os.path.abspath(os.path.expanduser(str(data_dir_val)))

    return None


def get_log_level() -> str:
    # 1. Environment Variable JOTTER_LOG_LEVEL
    log_level = os.environ.get("JOTTER_LOG_LEVEL")
    if log_level:
        lvl = log_level.upper()
        return "WARNING" if lvl == "WARN" else lvl

    # 2. Config File
    config = _get_config()
    log_level_val = config.get("log_level") or config.get("log-level")
    if log_level_val:
        lvl = str(log_level_val).upper()
        return "WARNING" if lvl == "WARN" else lvl

    # 3. Default: WARNING for production, INFO for local dev
    if IS_PRODUCTION:
        return "WARNING"
    return "INFO"
