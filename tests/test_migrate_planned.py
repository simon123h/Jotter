import importlib.util
import json
from datetime import date
from pathlib import Path

import pytest

SCRIPT = Path(__file__).parent.parent / "scripts" / "migrate_planned.py"
spec = importlib.util.spec_from_file_location("migrate_planned", SCRIPT)
assert spec and spec.loader
migrate = importlib.util.module_from_spec(spec)
spec.loader.exec_module(migrate)

TODAY = date(2026, 10, 14)
CASES = json.loads((Path(__file__).parent / "data" / "legacy_planned.json").read_text())["cases"]


def planned_after(frontmatter: str) -> str | None:
    result = migrate.migrate_text(f"---\n{frontmatter}\n---\nbody\n", TODAY)
    return result


@pytest.mark.parametrize("case", CASES, ids=lambda c: f"{c['value']}@{c['today']}")
def test_keywords_become_the_date_they_stand_for(case: dict) -> None:
    result = migrate.migrate_text(
        f"---\ntitle: T\nplanned_date: {case['value']}\n---\n", date.fromisoformat(case["today"])
    )
    expected = f"---\ntitle: T\nplanned_date: {case['expected']}\n---\n" if case["expected"] else "---\ntitle: T\n---\n"
    assert result == expected


def test_a_postponement_ahead_becomes_the_planned_date() -> None:
    assert (
        planned_after("title: T\npostponed_until: 2026-10-22") == "---\ntitle: T\nplanned_date: 2026-10-22\n---\nbody\n"
    )


def test_a_postponement_over_a_week_replaces_it_and_keeps_the_place_of_the_planned_line() -> None:
    result = planned_after("title: T\nplanned_date: 2026-W43\npostponed_until: 2026-11-22\ntags: [a]")
    assert result == "---\ntitle: T\nplanned_date: 2026-11-22\ntags: [a]\n---\nbody\n"


def test_a_later_planned_day_wins_over_the_postponement() -> None:
    result = planned_after("title: T\nplanned_date: 2026-12-01\npostponed_until: 2026-10-22")
    assert result == "---\ntitle: T\nplanned_date: 2026-12-01\n---\nbody\n"


def test_a_postponement_that_has_passed_is_just_dropped() -> None:
    assert planned_after("title: T\npostponed_until: 2026-10-14") == "---\ntitle: T\n---\nbody\n"


def test_camel_case_keys_and_quotes_are_read() -> None:
    result = planned_after('title: T\nplannedDate: "tomorrow"\npostponedUntil: "2026-02-03"')
    assert result == "---\ntitle: T\nplanned_date: 2026-10-15\n---\nbody\n"


def test_a_keyword_in_due_date_becomes_the_planned_date() -> None:
    assert planned_after("title: T\ndue_date: today") == "---\ntitle: T\nplanned_date: 2026-10-14\n---\nbody\n"


def test_an_empty_postponement_goes_too() -> None:
    assert planned_after("title: T\npostponed_until: null\ntags: [a]") == "---\ntitle: T\ntags: [a]\n---\nbody\n"


def test_a_real_due_date_and_a_current_planned_date_are_left_alone() -> None:
    assert planned_after("title: T\ndue_date: 2026-11-01\nplanned_date: 2026-W43") is None
    assert planned_after("title: T\nplanned_date: null") is None


def test_files_without_frontmatter_are_left_alone() -> None:
    assert migrate.migrate_text("just text\n", TODAY) is None


def test_the_old_switch_in_the_settings_becomes_a_horizon() -> None:
    assert json.loads(migrate.migrate_settings('{"hidePostponedColumn": false, "language": "de"}')) == {
        "language": "de",
        "planningHorizon": "all",
    }
    assert json.loads(migrate.migrate_settings('{"hidePostponedColumn": true}')) == {"planningHorizon": "today"}
    assert migrate.migrate_settings('{"planningHorizon": "week"}') is None


def test_a_vault_is_changed_only_with_write(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    project = tmp_path / "p"
    project.mkdir()
    task = project / "a.md"
    task.write_text("---\ntitle: T\nplanned_date: thisWeek\n---\n", encoding="utf-8")
    (project / "index.md").write_text("---\nplanned_date: today\n---\n", encoding="utf-8")

    monkeypatch.setattr("sys.argv", ["migrate_planned.py", str(tmp_path)])
    assert migrate.main() == 0
    assert task.read_text(encoding="utf-8").endswith("planned_date: thisWeek\n---\n")
    assert "would change p/a.md" in capsys.readouterr().out

    monkeypatch.setattr("sys.argv", ["migrate_planned.py", str(tmp_path), "--write"])
    assert migrate.main() == 0
    assert "planned_date: thisWeek" not in task.read_text(encoding="utf-8")
    assert (project / "index.md").read_text(encoding="utf-8") == "---\nplanned_date: today\n---\n"
