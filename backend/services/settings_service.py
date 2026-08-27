import json
import tempfile
from pathlib import Path
from backend.models.settings import AppSettings


def load_settings(data_dir: str) -> AppSettings:
    settings_file = Path(data_dir) / "settings.json"
    if not settings_file.is_file():
        default_settings = AppSettings()
        save_settings(data_dir, default_settings)
        return default_settings

    try:
        with open(settings_file, "r", encoding="utf-8") as f:
            data = json.load(f)
            return AppSettings(**data)
    except Exception:
        default_settings = AppSettings()
        return default_settings


def save_settings(data_dir: str, settings: AppSettings) -> None:
    settings_file = Path(data_dir) / "settings.json"
    parent = settings_file.parent
    parent.mkdir(parents=True, exist_ok=True)

    data = settings.model_dump_json(indent=2)
    with tempfile.NamedTemporaryFile("w", dir=parent, delete=False, encoding="utf-8") as tf:
        tf.write(data)
        temp_name = tf.name

    Path(temp_name).replace(settings_file)
