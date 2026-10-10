"""Runs the shared search fixtures (spec/fixtures/search) against the SQLite index.

The TypeScript implementation (packages/task-filter, used by the web and the mobile app) runs the same cases.
"""

import json
import sqlite3
from pathlib import Path
from typing import Any

import pytest

from jotter.features.tasks.domain import Task
from jotter.features.tasks.sqlite_repo import SqliteTaskRepository
from jotter.shared.db import init_schema

FIXTURES = Path(__file__).resolve().parent.parent / "spec" / "fixtures" / "search"
MATCH = json.loads((FIXTURES / "match.json").read_text(encoding="utf-8"))

LISTS = {"buckets", "exclude_buckets", "priorities"}


def _kwargs(filter_: dict[str, Any]) -> dict[str, Any]:
    """The filter as the API hands it to the repository: comma-separated values become lists."""
    out: dict[str, Any] = {}
    for key, value in filter_.items():
        if key in LISTS or key == "tags":
            out[key] = [v.strip() for v in value.split(",") if v.strip()]
        else:
            out[key] = value
    return out


@pytest.fixture
def repo() -> SqliteTaskRepository:
    conn = sqlite3.connect(":memory:")
    conn.row_factory = sqlite3.Row
    init_schema(conn)
    repo = SqliteTaskRepository(conn)
    for position, row in enumerate(MATCH["tasks"]):
        task = Task.create(
            project_id="p",
            title=row["title"],
            bucket=row["bucket"],
            position=float(position + 1),
            tags=row["tags"],
            body=row["body"],
            due_date=row["due_date"],
            planned_date=row["planned_date"],
            priority=row["priority"],
            postponed_until=row["postponed_until"],
            task_id=row["id"].upper().ljust(26, "0"),
        )
        task.created_at = row["created_at"]
        task.updated_at = row["updated_at"]
        repo.upsert_task(task)
    return repo


@pytest.mark.parametrize("case", MATCH["cases"], ids=[c["name"] for c in MATCH["cases"]])
def test_search_case(repo: SqliteTaskRepository, case: dict[str, Any]) -> None:
    found = repo.find_tasks(project_id="p", **_kwargs(case["filter"]))
    assert [str(t.id)[0].lower() for t in found] == case["ids"]
