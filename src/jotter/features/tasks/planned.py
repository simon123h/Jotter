"""The planned date: a day, an ISO week or a month (spec/FORMAT.md, "Dates and times").

A planned date is always absolute. Files from before 5.0 (a planning keyword, `postponed_until`) are converted by
`scripts/migrate_planned.py`; the reader does not know them.
"""

import re
from dataclasses import dataclass
from datetime import date, timedelta

from jotter.shared.exceptions import ValidationError

# ASCII digits only, and years from 1000 on: both readers agree on what a planned value is (spec/FORMAT.md)
_DAY = re.compile(r"^([1-9][0-9]{3}-[0-9]{2}-[0-9]{2})(?:[T ].*)?\Z")
_WEEK = re.compile(r"^([1-9][0-9]{3})-[Ww]([0-9]{2})\Z")
_MONTH = re.compile(r"^([1-9][0-9]{3})-([0-9]{2})\Z")


def _week(day: date) -> str:
    year, week, _ = day.isocalendar()
    return f"{year}-W{week:02d}"


def _month(day: date) -> str:
    return f"{day.year}-{day.month:02d}"


def search_word(raw: str, today: date) -> str | None:
    """The day, week or month a word of the search stands for on `today` (`today`, `thisWeek`, `nextMonth`, ...)."""
    match raw.strip().lower():
        case "today":
            return today.isoformat()
        case "tomorrow":
            return (today + timedelta(days=1)).isoformat()
        case "thisweek":
            return _week(today)
        case "nextweek":
            return _week(today + timedelta(weeks=1))
        case "thismonth":
            return _month(today)
        case "nextmonth":
            return _month(date(today.year + today.month // 12, today.month % 12 + 1, 1))
    return None


def canonical_planned(raw: str) -> str | None:
    """The day, week or month `raw` stands for, in its written form. `None` when it is none of them."""
    text = raw.strip()
    try:
        if match := _DAY.match(text):
            return date.fromisoformat(match.group(1)).isoformat()
        if match := _WEEK.match(text):
            year, week = int(match.group(1)), int(match.group(2))
            date.fromisocalendar(year, week, 1)
            return f"{year}-W{week:02d}"
        if match := _MONTH.match(text):
            year, month = int(match.group(1)), int(match.group(2))
            date(year, month, 1)
            return f"{year}-{month:02d}"
    except ValueError:
        return None
    return None


def planned_start(value: str) -> date:
    """The first day of a planned value (a day is its own first day)."""
    if match := _WEEK.match(value):
        return date.fromisocalendar(int(match.group(1)), int(match.group(2)), 1)
    if match := _MONTH.match(value):
        return date(int(match.group(1)), int(match.group(2)), 1)
    return date.fromisoformat(value)


def planned_span(value: str, today: date | None = None) -> tuple[str, str] | None:
    """The first and last day a search for `value` covers: a day, a week or a month, or with `today` a word for one
    (`thisWeek`). `None` when it is none of them."""
    text = (search_word(value, today) if today else None) or canonical_planned(value)
    if text is None:
        return None
    start = planned_start(text)
    try:
        if len(text) == 10:
            end = start
        elif "W" in text:
            end = start + timedelta(days=6)
        else:
            end = date(start.year + start.month // 12, start.month % 12 + 1, 1) - timedelta(days=1)
    except (OverflowError, ValueError):
        end = date.max  # the last month or week of year 9999 reaches past the calendar
    return start.isoformat(), end.isoformat()


@dataclass(frozen=True)
class PlannedDate:
    value: str | None  # "YYYY-MM-DD", "YYYY-Www" or "YYYY-MM"

    @classmethod
    def from_str(cls, val: str | None) -> "PlannedDate":
        """Reads a value given by a caller; anything that is not a day, week or month is an error."""
        if not val or not str(val).strip():
            return cls(value=None)
        clean = canonical_planned(str(val))
        if clean is None:
            raise ValidationError(f"Invalid planned date: '{val}' (expected YYYY-MM-DD, YYYY-Www or YYYY-MM)")
        return cls(value=clean)

    @property
    def as_date(self) -> date | None:
        """The day, when this is a day (not a week or a month)."""
        if self.value and len(self.value) == 10:
            return date.fromisoformat(self.value)
        return None

    def __str__(self) -> str:
        return self.value or ""
