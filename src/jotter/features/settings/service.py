"""Application service for Settings persistence."""

import json
import tempfile
from pathlib import Path

from jotter.features.settings.schemas import AppSettings, SettingsUpdate


class SettingsApplicationService:
    def __init__(self, data_dir: str):
        self.data_dir = data_dir

    def load_settings(self) -> AppSettings:
        settings_file = Path(self.data_dir) / "settings.json"
        if not settings_file.is_file():
            default_settings = AppSettings()
            self.save_settings(default_settings)
            return default_settings

        try:
            with open(settings_file, encoding="utf-8") as f:
                data = json.load(f)
                return AppSettings(**data)
        except Exception:
            default_settings = AppSettings()
            return default_settings

    def save_settings(self, settings: AppSettings) -> None:
        settings_file = Path(self.data_dir) / "settings.json"
        parent = settings_file.parent
        parent.mkdir(parents=True, exist_ok=True)

        data = settings.model_dump_json(by_alias=True, indent=2)
        with tempfile.NamedTemporaryFile("w", dir=parent, delete=False, encoding="utf-8") as tf:
            tf.write(data)
            temp_name = tf.name

        Path(temp_name).replace(settings_file)

    def update_settings(self, updates: SettingsUpdate) -> AppSettings:
        current = self.load_settings()
        update_data = updates.model_dump(exclude_unset=True)
        updated = current.model_copy(update=update_data)
        self.save_settings(updated)
        return updated
