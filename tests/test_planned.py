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


@pytest.mark.parametrize(
    "value",
    [
        "0000-01-01",
        "0999-12-31",
        "0000-W01",
        "\u0662\u0660\u0662\u0666-\u0661\u0660-\u0662\u0661",
        "\u0662\u0660\u0662\u0666-W43",
        "2026-\u0661\u0660",
    ],
)
def test_a_value_with_a_year_before_1000_or_non_ascii_digits_is_no_planned_date(value: str) -> None:
    assert read_planned(value, date(2026, 10, 14)) is None


def test_a_value_is_trimmed_as_the_typescript_reader_does() -> None:
    assert read_planned(" 2026-10\n", date(2026, 10, 14)) == "2026-10"
    assert read_planned("2026-w43\n", date(2026, 10, 14)) == "2026-W43"
    assert read_planned("2026-13", date(2026, 10, 14)) is None
