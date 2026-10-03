"""Disk repository and application service for project JSON Canvas (.canvas) files."""

import json
import logging
from datetime import datetime, timezone
from pathlib import Path

from jotter.features.canvas.schemas import CanvasDocument, CanvasMeta
from jotter.shared.exceptions import EntityNotFoundError, ValidationError
from jotter.shared.fs import atomic_write
from jotter.shared.slug import slugify

logger = logging.getLogger(__name__)


class CanvasApplicationService:
    def __init__(self, data_dir: Path | str):
        self.data_dir = Path(data_dir)

    def _get_project_dir(self, project_id: str) -> Path:
        proj_dir = self.data_dir / project_id
        if not proj_dir.is_dir():
            raise EntityNotFoundError(f"Project '{project_id}' not found")
        return proj_dir

    def _resolve_canvas_filename(self, canvas_id: str) -> str:
        clean_id = canvas_id.strip()
        if not clean_id.endswith(".canvas"):
            clean_id = f"{clean_id}.canvas"
        return clean_id

    def list_canvases(self, project_id: str) -> list[CanvasMeta]:
        proj_dir = self._get_project_dir(project_id)
        canvases: list[CanvasMeta] = []
        for file_path in sorted(proj_dir.glob("*.canvas")):
            if file_path.is_file():
                stem = file_path.stem
                title = stem.replace("-", " ").replace("_", " ").title()
                stats = file_path.stat()
                canvases.append(
                    CanvasMeta(
                        id=stem,
                        title=title,
                        filename=file_path.name,
                        created_at=datetime.fromtimestamp(stats.st_ctime, tz=timezone.utc).isoformat(),
                        updated_at=datetime.fromtimestamp(stats.st_mtime, tz=timezone.utc).isoformat(),
                    )
                )

        # If no canvas exists yet in project, return empty list (or caller can create default)
        return canvases

    def get_canvas(self, project_id: str, canvas_id: str) -> CanvasDocument:
        proj_dir = self._get_project_dir(project_id)
        filename = self._resolve_canvas_filename(canvas_id)
        file_path = proj_dir / filename

        if not file_path.is_file():
            # If requesting "default" or "main" and none exists, return an empty document
            if canvas_id in ("default", "main"):
                return CanvasDocument(nodes=[], edges=[])
            raise EntityNotFoundError(f"Canvas '{canvas_id}' not found in project '{project_id}'")

        content = file_path.read_text(encoding="utf-8").strip()
        if not content:
            return CanvasDocument(nodes=[], edges=[])
        try:
            data = json.loads(content)
            return CanvasDocument(**data)
        except Exception as e:
            logger.warning("Failed to parse canvas file %s: %s", file_path, e)
            raise ValidationError(f"Invalid canvas file '{filename}': {e}") from e

    def save_canvas(self, project_id: str, canvas_id: str, doc: CanvasDocument) -> CanvasDocument:
        proj_dir = self._get_project_dir(project_id)
        slug = slugify(canvas_id) or "canvas"
        filename = f"{slug}.canvas"
        file_path = proj_dir / filename

        content = doc.model_dump_json(indent=2, exclude_none=True)
        atomic_write(file_path, content, encoding="utf-8", prefix=f".{slug}_", suffix=".tmp")
        return doc

    def delete_canvas(self, project_id: str, canvas_id: str) -> None:
        proj_dir = self._get_project_dir(project_id)
        filename = self._resolve_canvas_filename(canvas_id)
        file_path = proj_dir / filename
        if not file_path.is_file():
            raise EntityNotFoundError(f"Canvas '{canvas_id}' not found in project '{project_id}'")
        file_path.unlink()
