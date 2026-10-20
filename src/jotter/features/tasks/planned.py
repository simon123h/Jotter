"""The planned date: a day, an ISO week or a month (spec/FORMAT.md, "Dates and times").

A planned date is always absolute. The legacy values of older files (a planning keyword, `postponed_until`) are
resolved against today when a file is read, so nothing else has to know about them.
"""

import re
from dataclasses import dataclass
from datetime import date, timedelta

from jotter.shared.exceptions import ValidationError

# ASCII digits only, and years from 1000 on: both readers agree on what a planned value is (spec/FORMAT.md)
_DAY = re.compile(r"^([1-9][0-9]{3}-[0-9]{2}-[0-9]{2})(?:[T ].*)?\Z")
_WEEK = re.compile(r"^([1-9][0-9]{3})-[Ww]([0-9]{2})\Z")
_MONTH = re.compile(r"^([1-9][0-9]{3})-([0-9]{2})\Z")

# Legacy planning keywords, compared case-insensitively and ignoring hyphens (`this-week` is `thisWeek`).
_NO_DATE = frozenset({"thisyear", "nextyear", "someday", "sometime"})
_KEYWORDS = frozenset({"today", "tomorrow", "thisweek", "nextweek", "thismonth", "nextmonth"}) | _NO_DATE


def _keyword(raw: str) -> str:
    return raw.strip().lower().replace("-", "")


def is_planning_keyword(raw: str) -> bool:
    """True for a legacy planning keyword (`today`, `thisWeek`, `someday`, ...)."""
    return _keyword(raw) in _KEYWORDS


def _week(day: date) -> str:
    year, week, _ = day.isocalendar()
    return f"{year}-W{week:02d}"


def _month(day: date) -> str:
    return f"{day.year}-{day.month:02d}"


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


def resolve_keyword(raw: str, today: date) -> str | None:
    """The planned date a legacy keyword stands for on `today`. `None` for those without a date."""
    word = _keyword(raw)
    match word:
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


def planned_start(value: str) -> date:
    """The first day of a planned value (a day is its own first day)."""
    if match := _WEEK.match(value):
        return date.fromisocalendar(int(match.group(1)), int(match.group(2)), 1)
    if match := _MONTH.match(value):
        return date(int(match.group(1)), int(match.group(2)), 1)
    return date.fromisoformat(value)


def is_legacy(planned_raw: object, postponed_raw: object, today: date) -> bool:
    """True when a file holds a planning keyword or a postponement that is still ahead. Such a file is read again on every
    scan until it is saved, so that the day it stands for follows the calendar the way it always did, on every device."""
    if planned_raw and is_planning_keyword(str(planned_raw)):
        return True
    match = _DAY.match(str(postponed_raw).strip()) if postponed_raw else None
    try:
        return bool(match) and date.fromisoformat(match.group(1)) > today  # type: ignore[union-attr]
    except ValueError:
        return False


def planned_span(value: str, today: date) -> tuple[str, str] | None:
    """The first and last day a search for `value` covers: a day, a week, a month, or a legacy keyword for one.
    `None` when `value` is none of them."""
    text = read_planned(value, today) if is_planning_keyword(value) else canonical_planned(value)
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


def read_planned(raw: object, today: date) -> str | None:
    """A planned date as found in a file: a canonical value, a legacy keyword resolved, anything else dropped."""
    if not raw:
        return None
    text = str(raw)
    if is_planning_keyword(text):
        return resolve_keyword(text, today)
    return canonical_planned(text)


def merge_postponed(planned: str | None, postponed_raw: object, today: date) -> str | None:
    """Folds a legacy `postponed_until` into the planned date: it wins when it lies after today and the planned
    date starts before it."""
    if not postponed_raw:
        return planned
    match = _DAY.match(str(postponed_raw).strip())
    try:
        postponed = date.fromisoformat(match.group(1)) if match else None
    except ValueError:
        postponed = None
    if postponed is None or postponed <= today:
        return planned
    if planned is not None and planned_start(planned) >= postponed:
        return planned
    return postponed.isoformat()


@dataclass(frozen=True)
class PlannedDate:
    value: str | None  # "YYYY-MM-DD", "YYYY-Www" or "YYYY-MM"

    @classmethod
    def from_str(cls, val: str | None, today: date | None = None) -> "PlannedDate":
        """Reads a value given by a caller: a legacy keyword is resolved against `today`, anything else that is not a
        day, week or month is an error."""
        if not val or not str(val).strip():
            return cls(value=None)
        text = str(val).strip()
        if is_planning_keyword(text):
            return cls(value=resolve_keyword(text, today or date.today()))
        clean = canonical_planned(text)
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
