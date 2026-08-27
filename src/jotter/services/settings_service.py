"""Settings service facade delegating to features.settings."""

from jotter.features.settings.schemas import AppSettings
from jotter.features.settings.service import SettingsApplicationService


def load_settings(data_dir: str) -> AppSettings:
    return SettingsApplicationService(data_dir).load_settings()


def save_settings(data_dir: str, settings: AppSettings) -> None:
    SettingsApplicationService(data_dir).save_settings(settings)
