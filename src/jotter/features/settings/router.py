"""FastAPI routes for Application Settings."""

from fastapi import APIRouter, Depends

from jotter.features.settings.schemas import AppSettings, SettingsUpdate
from jotter.features.settings.service import SettingsApplicationService
from jotter.shared.deps import get_data_dir

router = APIRouter(prefix="/api/settings", tags=["settings"])


def get_service(data_dir: str = Depends(get_data_dir)) -> SettingsApplicationService:
    return SettingsApplicationService(data_dir)


@router.get("", response_model=AppSettings)
def get_settings(svc: SettingsApplicationService = Depends(get_service)):
    return svc.load_settings()


@router.put("", response_model=AppSettings)
@router.patch("", response_model=AppSettings)
@router.post("", response_model=AppSettings)
def update_settings(updates: SettingsUpdate, svc: SettingsApplicationService = Depends(get_service)):
    return svc.update_settings(updates)
