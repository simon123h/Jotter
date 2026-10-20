"""Rolling a recurring task over when it is completed (spec/FORMAT.md, "Recurring tasks").

Pure: the result depends on the task and `today` only, so two devices that complete the same task on the same day
write the same dates.
"""

import calendar
import re
from datetime import date, datetime, timedelta

from jotter.features.tasks.domain import DueDate, RepeatRule, Task
from jotter.features.tasks.planned import PlannedDate

_UNTICK = re.compile(r"(?m)^(\s*[-*+] \[)[xX](\])")


def add_units(day: date, every: int, unit: str, steps: int = 1) -> date:
    """`day` plus `steps` times `every` units. A month or year step clamps to the end of a shorter month."""
    n = every * steps
    if unit == "day":
        return day + timedelta(days=n)
    if unit == "week":
        return day + timedelta(weeks=n)
    months = n * 12 if unit == "year" else n
    year, month = divmod(day.year * 12 + day.month - 1 + months, 12)
    month += 1
    return date(year, month, min(day.day, calendar.monthrange(year, month)[1]))


def next_occurrence(rule: RepeatRule, due: date | None, today: date) -> date:
    """The day the task comes back: from the completion day, or from the due day on the rhythm, never before today."""
    if rule.from_ == "due" and due is not None:
        steps = 1
        while (candidate := add_units(due, rule.every, rule.unit, steps)) < today:
            steps += 1
        return candidate
    return add_units(today, rule.every, rule.unit)


def roll_over(task: Task, today: date, default_bucket: str, previous_bucket: str | None = None) -> bool:
    """Rolls a recurring task over in place. Returns False (and changes nothing) when the task does not repeat."""
    rule = task.repeat
    if rule is None:
        return False
    due = task.due_date.as_date
    following = next_occurrence(rule, due, today)

    planned = task.planned_date.as_date
    anchor = due
    if anchor is None and task.reminders:
        anchor = date.fromisoformat(task.reminders[0][:10])  # reminders are sorted
    shift = timedelta(days=(following - (anchor or planned or today)).days)

    if due is not None:
        task.due_date = DueDate(following.isoformat())
    # By decision (ADR 0024), not an oversight: the task reappears when its planned day comes, so it must have one. A planned
    # day keeps its distance to the due date; a week, a month or no plan becomes `following`.
    task.planned_date = PlannedDate((planned + shift if planned is not None else following).isoformat())
    task.reminders = [(datetime.fromisoformat(r) + shift).strftime("%Y-%m-%dT%H:%M") for r in task.reminders]
    task.bucket = previous_bucket or default_bucket
    task.body = _UNTICK.sub(r"\1 \2", task.body)
    task.touch()
    return True
