from pathlib import Path

from jotter.features.canvas.schemas import CanvasDocument, CanvasEdge, CanvasGenericNode
from jotter.features.canvas.service import CanvasApplicationService
from jotter.features.projects.schemas import ProjectCreate
from jotter.features.projects.service import ProjectApplicationService
from jotter.shared.db import create_sqlite_connection


def test_canvas_crud_workflow(temp_dir, test_env):
    conn = create_sqlite_connection(str(Path(temp_dir) / "tasks.db"))
    proj_svc = ProjectApplicationService.from_data_dir(temp_dir, conn)
    canvas_svc = CanvasApplicationService(temp_dir)

    # 1. Create a project
    proj_svc.create_project(ProjectCreate(title="Roadmap", id="roadmap"))

    # 2. Initially, no canvases
    canvases = canvas_svc.list_canvases("roadmap")
    assert len(canvases) == 0

    # 3. Create / save a canvas adhering to JSON Canvas format
    doc = CanvasDocument(
        nodes=[
            CanvasGenericNode(
                id="node-1",
                type="file",
                file="01ARZ3NDEKTSV4RRFFQ69G5FAV.md",
                x=100.0,
                y=200.0,
                width=300.0,
                height=150.0,
                color="#3b82f6",
            ),
            CanvasGenericNode(
                id="node-2",
                type="text",
                text="## Milestone 1\nLaunch core MVP",
                x=500.0,
                y=200.0,
                width=250.0,
                height=120.0,
            ),
            CanvasGenericNode(
                id="group-1",
                type="group",
                label="Backend Layer",
                x=50.0,
                y=150.0,
                width=800.0,
                height=300.0,
            ),
        ],
        edges=[
            CanvasEdge(
                id="edge-1",
                fromNode="node-1",
                fromSide="right",
                toNode="node-2",
                toSide="left",
                color="#64748b",
            )
        ],
    )

    canvas_svc.save_canvas("roadmap", "sprint-overview", doc)

    # 4. Verify listed
    listed = canvas_svc.list_canvases("roadmap")
    assert len(listed) == 1
    assert listed[0].id == "sprint-overview"
    assert listed[0].filename == "sprint-overview.canvas"

    # 5. Verify retrieved content
    loaded = canvas_svc.get_canvas("roadmap", "sprint-overview")
    assert len(loaded.nodes) == 3
    assert len(loaded.edges) == 1
    assert loaded.nodes[0].file == "01ARZ3NDEKTSV4RRFFQ69G5FAV.md"
    assert loaded.nodes[1].text == "## Milestone 1\nLaunch core MVP"
    assert loaded.edges[0].fromNode == "node-1"

    # 6. Delete canvas
    canvas_svc.delete_canvas("roadmap", "sprint-overview")
    assert len(canvas_svc.list_canvases("roadmap")) == 0


def test_canvas_error_and_fallback_handling(temp_dir, test_env):
    import pytest

    from jotter.shared.exceptions import EntityNotFoundError, ValidationError

    conn = create_sqlite_connection(str(Path(temp_dir) / "tasks.db"))
    proj_svc = ProjectApplicationService.from_data_dir(temp_dir, conn)
    canvas_svc = CanvasApplicationService(temp_dir)

    proj_svc.create_project(ProjectCreate(title="Roadmap", id="roadmap"))

    # Default/main canvas when not created returns empty doc
    default_doc = canvas_svc.get_canvas("roadmap", "main")
    assert len(default_doc.nodes) == 0
    assert len(default_doc.edges) == 0

    # Non-existent non-default canvas raises EntityNotFoundError
    with pytest.raises(EntityNotFoundError):
        canvas_svc.get_canvas("roadmap", "nonexistent")

    # Malformed canvas file on disk raises ValidationError rather than silently erasing
    proj_dir = Path(temp_dir) / "roadmap"
    corrupt_file = proj_dir / "corrupted.canvas"
    corrupt_file.write_text("{ this is invalid json [", encoding="utf-8")

    with pytest.raises(ValidationError):
        canvas_svc.get_canvas("roadmap", "corrupted")
