"""Runs the shared vault-format fixtures (spec/fixtures) against the Python implementation.

Other implementations (the TypeScript parser used by the mobile app, experiments) run the same fixtures; see spec/README.md.
"""

import json
import tempfile
from pathlib import Path
from typing import Any

import pytest

from jotter.features.projects.manifest import KNOWN_MANIFEST_KEYS, read_project_manifest, write_project_manifest
from jotter.features.tasks.disk_repo import DiskTaskRepository
from jotter.shared.exceptions import ValidationError
from jotter.shared.frontmatter import split_frontmatter
from jotter.shared.yaml_io import safe_load

FIXTURES = Path(__file__).resolve().parent.parent / "spec" / "fixtures"
TASK_CASES = sorted((FIXTURES / "tasks").glob("*.json"))
PROJECT_CASES = sorted((FIXTURES / "projects").glob("*.json"))


def _task_view(task: Any, expected: dict[str, Any]) -> dict[str, Any]:
    view: dict[str, Any] = {
        "id": str(task.id),
        "project_id": task.project_id,
        "title": task.title,
        "bucket": task.bucket,
        "position": float(task.position),
        "tags": [t.value for t in task.tags],
        "attachments": list(task.attachments),
        "body": task.body,
        "due_date": task.due_date.value,
        "planned_date": task.planned_date.value,
        "priority": task.priority.value,
        "color": task.color,
        "postponed_until": task.postponed_until.value,
        "extra": dict(task.extra_frontmatter),
    }
    # Timestamps default to "now" when absent, so only compare them when the fixture states them
    for key in ("created_at", "updated_at"):
        if key in expected:
            view[key] = getattr(task, key)
    return view


@pytest.mark.parametrize("case", TASK_CASES, ids=lambda p: p.stem)
def test_task_read(case: Path) -> None:
    spec = json.loads(case.read_text(encoding="utf-8"))
    ctx, expected = spec["context"], spec["expected"]
    repo = DiskTaskRepository(tempfile.gettempdir())
    content = case.with_suffix(".md").read_text(encoding="utf-8")

    if expected.get("error"):
        with pytest.raises(ValidationError):
            repo.parse_task_content(content, ctx["file_stem"], ctx["default_project_id"])
        return
    task = repo.parse_task_content(content, ctx["file_stem"], ctx["default_project_id"])

    assert _task_view(task, expected) == expected


@pytest.mark.parametrize("case", TASK_CASES, ids=lambda p: p.stem)
def test_task_round_trip(case: Path) -> None:
    """Writing a task and reading it back must not change anything, unknown frontmatter included."""
    spec = json.loads(case.read_text(encoding="utf-8"))
    ctx, expected = spec["context"], spec["expected"]
    if expected.get("error"):
        pytest.skip("unreadable files are never written")
    repo = DiskTaskRepository(tempfile.gettempdir())
    content = case.with_suffix(".md").read_text(encoding="utf-8")

    first = repo.parse_task_content(content, ctx["file_stem"], ctx["default_project_id"])
    written = repo.serialize_task(first)
    second = repo.parse_task_content(written, ctx["file_stem"], ctx["default_project_id"])

    assert _task_view(second, expected) == expected


def _project_view(project: Any, buckets: list[Any]) -> dict[str, Any]:
    return {
        "id": project.id,
        "title": project.name,
        "description": project.description,
        "done_clean_period": project.done_clean_period,
        "created_at": project.created_at,
        "buckets": [
            {
                "name": b.name,
                "title": b.title,
                "subtitle": b.subtitle,
                "position": float(b.position),
                "color": b.color,
                "layout": b.layout,
                "max_tasks": b.max_tasks,
                "is_default": b.is_default,
            }
            for b in buckets
        ],
    }


def _without_unstated_timestamp(view: dict[str, Any], expected: dict[str, Any]) -> dict[str, Any]:
    if "created_at" not in expected:
        view = {k: v for k, v in view.items() if k != "created_at"}
    return view


@pytest.mark.parametrize("case", PROJECT_CASES, ids=lambda p: p.stem)
def test_project_read_and_round_trip(case: Path, tmp_path: Path) -> None:
    spec = json.loads(case.read_text(encoding="utf-8"))
    ctx, expected = spec["context"], spec["expected"]
    # `extra` (unknown keys) and `body` describe what must survive a rewrite, they are not part of the parsed project
    parsed_expected = {k: v for k, v in expected.items() if k not in ("extra", "body")}
    project_dir = tmp_path / ctx["dir_name"]
    project_dir.mkdir()
    index_file = project_dir / "index.md"
    index_file.write_text(case.with_suffix(".md").read_text(encoding="utf-8"), encoding="utf-8")

    project, buckets = read_project_manifest(project_dir, ctx["dir_name"])
    assert _without_unstated_timestamp(_project_view(project, buckets), parsed_expected) == parsed_expected

    write_project_manifest(project_dir, project, buckets)
    project2, buckets2 = read_project_manifest(project_dir, ctx["dir_name"])
    assert _without_unstated_timestamp(_project_view(project2, buckets2), parsed_expected) == parsed_expected

    yaml_text, body = split_frontmatter(index_file.read_text(encoding="utf-8"))
    written = safe_load(yaml_text or "") or {}
    if "extra" in expected:
        assert {k: v for k, v in written.items() if k not in KNOWN_MANIFEST_KEYS} == expected["extra"]
    if "body" in expected:
        assert body == expected["body"]
