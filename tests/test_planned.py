"""The legacy planned values are resolved as spec/fixtures/planned/legacy.json says."""

import json
from datetime import date
from pathlib import Path

import pytest

from jotter.features.tasks.planned import read_planned

SPEC = json.loads(
    (Path(__file__).resolve().parent.parent / "spec" / "fixtures" / "planned" / "legacy.json").read_text(
        encoding="utf-8"
    )
)


@pytest.mark.parametrize("case", SPEC["cases"], ids=lambda c: f"{c['value']} on {c['today']}")
def test_legacy_keyword(case: dict[str, str | None]) -> None:
    assert read_planned(case["value"], date.fromisoformat(str(case["today"]))) == case["expected"]
