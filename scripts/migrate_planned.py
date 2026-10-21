#!/usr/bin/env python3
"""Converts the planned dates of a vault written before Jotter 5.0 to the form it reads now.

Before 5.0 a task could hold a planning keyword (`planned_date: thisWeek`, or one in `due_date`) and a `postponed_until`
date that hid it until then. Jotter 5.0 turned them into dates when reading a file; from 6.0 it no longer does, so run
this once on every vault that still has such files:

    python3 scripts/migrate_planned.py ~/vault            # shows what would change
    python3 scripts/migrate_planned.py ~/vault --write    # changes the files

Keywords become the day, week or month they stand for today. A `postponed_until` that lies ahead becomes the planned
date if the task is not planned for later than that. Only these lines are touched, and `hidePostponedColumn: false` in
`settings.json` becomes `planningHorizon: all`. Make a Git commit first, so you can look at the diff.
"""

import argparse
import json
import os
import re
import sys
import tempfile
from datetime import date, timedelta
from pathlib import Path

NO_DATE = {"thisyear", "nextyear", "someday", "sometime"}
KEYWORDS = {"today", "tomorrow", "thisweek", "nextweek", "thismonth", "nextmonth"} | NO_DATE
DAY = re.compile(r"^([1-9][0-9]{3}-[0-9]{2}-[0-9]{2})(?:[T ].*)?$")
WEEK = re.compile(r"^([1-9][0-9]{3})-[Ww]([0-9]{2})$")
MONTH = re.compile(r"^([1-9][0-9]{3})-([0-9]{2})$")
LINE = re.compile(r"^(planned_date|plannedDate|due_date|dueDate|postponed_until|postponedUntil):[ \t]*(.*?)[ \t]*$")


def keyword(raw: str) -> str:
    return raw.strip().lower().replace("-", "")


def week_of(day: date) -> str:
    year, week, _ = day.isocalendar()
    return f"{year}-W{week:02d}"


def resolve(raw: str, today: date) -> str | None:
    """The planned date a keyword stands for on `today`; None for those without a date."""
    match keyword(raw):
        case "today":
            return today.isoformat()
        case "tomorrow":
            return (today + timedelta(days=1)).isoformat()
        case "thisweek":
            return week_of(today)
        case "nextweek":
            return week_of(today + timedelta(weeks=1))
        case "thismonth":
            return f"{today.year}-{today.month:02d}"
        case "nextmonth":
            return f"{today.year + today.month // 12}-{today.month % 12 + 1:02d}"
    return None


def start_of(value: str) -> date | None:
    """The first day of a day, week or month; None for anything else."""
    try:
        if match := DAY.match(value):
            return date.fromisoformat(match.group(1))
        if match := WEEK.match(value):
            return date.fromisocalendar(int(match.group(1)), int(match.group(2)), 1)
        if match := MONTH.match(value):
            return date(int(match.group(1)), int(match.group(2)), 1)
    except ValueError:
        pass
    return None


def unquote(value: str) -> str:
    value = value.split(" #")[0].strip()
    if len(value) >= 2 and value[0] == value[-1] and value[0] in "\"'":
        value = value[1:-1]
    return value.strip()


def migrate_text(text: str, today: date) -> str | None:
    """The file with its legacy planning values converted, or None when there is nothing to convert."""
    if not text.startswith("---"):
        return None
    lines = text.split("\n")
    end = next((i for i in range(1, len(lines)) if lines[i].rstrip() == "---"), None)
    if end is None:
        return None

    found: dict[str, tuple[int, str]] = {}  # key -> (line index, value)
    for i in range(1, end):
        if match := LINE.match(lines[i]):
            found.setdefault(match.group(1), (i, unquote(match.group(2))))

    def get(*keys: str) -> tuple[int, str] | None:
        return next((found[k] for k in keys if k in found and found[k][1] not in ("", "null", "~")), None)

    planned, due, postponed = (
        get("planned_date", "plannedDate"),
        get("due_date", "dueDate"),
        get("postponed_until", "postponedUntil"),
    )
    keyword_in_due = due is not None and keyword(due[1]) in KEYWORDS
    keyword_in_planned = planned is not None and keyword(planned[1]) in KEYWORDS
    has_postponed_key = any(key in found for key in ("postponed_until", "postponedUntil"))  # also an empty one goes
    if not (keyword_in_due or keyword_in_planned or has_postponed_key):
        return None

    source = planned if planned is not None else (due if keyword_in_due else None)
    value: str | None = None
    if source is not None:
        value = resolve(source[1], today) if keyword(source[1]) in KEYWORDS else source[1]
    if postponed is not None:
        until = start_of(postponed[1]) if DAY.match(postponed[1]) else None
        if until is not None and until > today:
            current = start_of(value) if value else None
            if current is None or current < until:
                value = until.isoformat()

    # The first line that held a legacy value takes the new planned_date; the others go
    old = {
        i
        for key, (i, _) in found.items()
        if key in ("planned_date", "plannedDate", "postponed_until", "postponedUntil")
    }
    if keyword_in_due and due is not None:
        old.add(due[0])
    first = min(old)
    out = []
    for i, line in enumerate(lines):
        if i == first and value is not None:
            out.append(f"planned_date: {value}")
        elif i not in old:
            out.append(line)
    return "\n".join(out)


def migrate_settings(text: str) -> str | None:
    try:
        data = json.loads(text)
    except ValueError:
        return None
    if not isinstance(data, dict) or "hidePostponedColumn" not in data:
        return None
    old = data.pop("hidePostponedColumn")
    if data.get("planningHorizon") not in ("today", "tomorrow", "week", "month", "all"):
        data["planningHorizon"] = "all" if old is False else "today"
    return json.dumps(data, indent=2, ensure_ascii=False) + "\n"


def write_atomic(path: Path, text: str) -> None:
    fd, tmp = tempfile.mkstemp(dir=path.parent, prefix=f".{path.stem}_", suffix=".tmp")
    try:
        with os.fdopen(fd, "w", encoding="utf-8", newline="") as handle:
            handle.write(text)
        os.replace(tmp, path)
    except BaseException:
        os.unlink(tmp)
        raise


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("vault", type=Path)
    parser.add_argument("--write", action="store_true", help="change the files (without it, only list them)")
    args = parser.parse_args()
    if not args.vault.is_dir():
        print(f"{args.vault} is not a folder", file=sys.stderr)
        return 1

    today = date.today()
    changed = 0
    for path in sorted(args.vault.rglob("*.md")):
        relative = path.relative_to(args.vault)
        if any(part.startswith(".") for part in relative.parts) or path.name == "index.md":
            continue
        try:
            text = path.read_bytes().decode("utf-8")
        except (OSError, UnicodeDecodeError) as error:
            print(f"skipped {relative}: {error}", file=sys.stderr)
            continue
        crlf = "\r\n" in text
        result = migrate_text(text.replace("\r\n", "\n"), today)
        if result is None:
            continue
        changed += 1
        print(f"{'changed' if args.write else 'would change'} {relative}")
        if args.write:
            write_atomic(path, result.replace("\n", "\r\n") if crlf else result)

    settings = args.vault / "settings.json"
    if settings.is_file() and (new_settings := migrate_settings(settings.read_text(encoding="utf-8"))) is not None:
        changed += 1
        print(f"{'changed' if args.write else 'would change'} settings.json")
        if args.write:
            write_atomic(settings, new_settings)

    print(f"{changed} file(s) {'changed' if args.write else 'would change (run again with --write)'}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
