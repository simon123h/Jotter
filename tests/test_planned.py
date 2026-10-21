"""What counts as a planned date (spec/FORMAT.md, "Dates and times")."""

import pytest

from jotter.features.tasks.planned import canonical_planned, planned_span


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
    assert canonical_planned(value) is None


def test_a_value_is_trimmed_as_the_typescript_reader_does() -> None:
    assert canonical_planned(" 2026-10\n") == "2026-10"
    assert canonical_planned("2026-w43\n") == "2026-W43"
    assert canonical_planned("2026-13") is None


def test_a_search_for_the_last_month_or_week_of_year_9999_does_not_overflow() -> None:
    assert planned_span("9999-12") == ("9999-12-01", "9999-12-31")
    start, end = planned_span("9999-W52")  # type: ignore[misc]
    assert start == "9999-12-27" and end >= start


@pytest.mark.parametrize("word", ["today", "thisWeek", "someday", "soon"])
def test_a_planning_keyword_is_no_planned_date(word: str) -> None:
    assert canonical_planned(word) is None
    assert planned_span(word) is None
