from fastapi import APIRouter, Request

from jotter.models.settings import AppSettings
from jotter.services.settings_service import load_settings, save_settings

router = APIRouter(prefix="/api/settings", tags=["settings"])


@router.get("", response_model=AppSettings)
def get_app_settings(request: Request):
    data_dir = request.app.state.config.data_dir
    return load_settings(data_dir)


@router.post("", status_code=200)
def save_app_settings(settings: AppSettings, request: Request):
    data_dir = request.app.state.config.data_dir
    save_settings(data_dir, settings)
    return {"status": "saved"}
