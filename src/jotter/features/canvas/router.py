"""FastAPI routes for Project JSON Canvas (.canvas) files."""

from fastapi import APIRouter, Depends, status

from jotter.features.canvas.schemas import CanvasDocument, CanvasMeta
from jotter.features.canvas.service import CanvasApplicationService
from jotter.shared.deps import get_data_dir

router = APIRouter(prefix="/api/projects/{project_id}/canvas", tags=["canvas"])


def get_canvas_service(data_dir: str = Depends(get_data_dir)) -> CanvasApplicationService:
    return CanvasApplicationService(data_dir)


@router.get("", response_model=list[CanvasMeta])
def list_canvases(
    project_id: str,
    svc: CanvasApplicationService = Depends(get_canvas_service),
):
    return svc.list_canvases(project_id)


@router.get("/{canvas_id}", response_model=CanvasDocument)
def get_canvas(
    project_id: str,
    canvas_id: str,
    svc: CanvasApplicationService = Depends(get_canvas_service),
):
    return svc.get_canvas(project_id, canvas_id)


@router.put("/{canvas_id}", response_model=CanvasDocument)
def save_canvas(
    project_id: str,
    canvas_id: str,
    doc: CanvasDocument,
    svc: CanvasApplicationService = Depends(get_canvas_service),
):
    return svc.save_canvas(project_id, canvas_id, doc)


@router.delete("/{canvas_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_canvas(
    project_id: str,
    canvas_id: str,
    svc: CanvasApplicationService = Depends(get_canvas_service),
):
    svc.delete_canvas(project_id, canvas_id)
