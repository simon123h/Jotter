"""Runs spec/fixtures/repeat/roll.json against the Python implementation of the roll-over."""

import json
from datetime import date
from pathlib import Path
from typing import Any

import pytest

from jotter.features.tasks.domain import RepeatRule, Task
from jotter.features.tasks.recurrence import roll_over

SPEC = json.loads(
    (Path(__file__).resolve().parent.parent / "spec" / "fixtures" / "repeat" / "roll.json").read_text("utf-8")
)


def _task(fields: dict[str, Any]) -> Task:
    return Task.create(
        project_id="proj",
        title="T",
        bucket=fields.get("previous_bucket") or "todo",
        body=fields.get("body", ""),
        due_date=fields.get("due_date"),
        planned_date=fields.get("planned_date"),
        repeat=RepeatRule.from_raw(fields["repeat"]),
        reminders=sorted(fields.get("reminders", [])),
    )


@pytest.mark.parametrize("case", SPEC["cases"], ids=lambda c: c["name"])
def test_roll_over(case: dict[str, Any]) -> None:
    task = _task(case["task"])

    assert roll_over(task, date.fromisoformat(case["today"]), SPEC["default_bucket"], case["task"]["previous_bucket"])

    assert {
        "bucket": task.bucket,
        "due_date": task.due_date.value,
        "planned_date": task.planned_date.value,
        "reminders": task.reminders,
        "body": task.body,
    } == case["expected"]


def test_a_task_without_a_rule_is_left_alone() -> None:
    task = Task.create(project_id="proj", title="T", due_date="2026-10-12")
    assert not roll_over(task, date(2026, 10, 12), "backlog")
    assert task.due_date.value == "2026-10-12"


@pytest.mark.parametrize("every", ["²", "٣", "3.5", "", " "])
def test_a_number_that_is_not_plain_digits_drops_the_rule_instead_of_failing(every: str) -> None:
    assert RepeatRule.from_raw({"every": every, "unit": "week"}) is None
