"""FastAPI routes for the web links saved as tasks."""

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from jotter.features.links.service import fetch_page_title
from jotter.features.settings.service import SettingsApplicationService
from jotter.shared.deps import get_data_dir

router = APIRouter(prefix="/api/links", tags=["links"])


class LinkTitleRequest(BaseModel):
    url: str


class LinkTitle(BaseModel):
    title: str | None = None


@router.post("/title", response_model=LinkTitle)
def link_title(req: LinkTitleRequest, data_dir: str = Depends(get_data_dir)) -> LinkTitle:
    """The title of the page at an address. Without the setting `lookUpLinkTitles` nothing is fetched."""
    if not SettingsApplicationService(data_dir).load_settings().lookUpLinkTitles:
        return LinkTitle()
    return LinkTitle(title=fetch_page_title(req.url))
