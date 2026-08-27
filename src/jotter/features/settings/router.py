"""FastAPI routes for Application Settings."""

from fastapi import APIRouter, Request

from jotter.features.settings.schemas import AppSettings, SettingsUpdate
from jotter.features.settings.service import SettingsApplicationService

router = APIRouter(prefix="/api/settings", tags=["settings"])


@router.get("", response_model=AppSettings)
def get_settings(request: Request):
    data_dir = request.app.state.config.data_dir
    return SettingsApplicationService(data_dir).load_settings()


@router.put("", response_model=AppSettings)
def update_settings(updates: SettingsUpdate, request: Request):
    data_dir = request.app.state.config.data_dir
    return SettingsApplicationService(data_dir).update_settings(updates)


@router.post("", response_model=AppSettings)
def post_settings(updates: SettingsUpdate, request: Request):
    data_dir = request.app.state.config.data_dir
    return SettingsApplicationService(data_dir).update_settings(updates)
