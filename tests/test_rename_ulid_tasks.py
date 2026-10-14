"""The one-off script that gives ULID-named tasks a file name from their title."""

import importlib.util
import json
from pathlib import Path

import pytest

from jotter.shared.slug import task_slug

SCRIPT = Path(__file__).parent.parent / "scripts" / "rename_ulid_tasks.py"
spec = importlib.util.spec_from_file_location("rename_ulid_tasks", SCRIPT)
assert spec and spec.loader
script = importlib.util.module_from_spec(spec)
spec.loader.exec_module(script)

OLD = "01M31EXNFWBGNQ3GQ5P8QYJM5N"
NEWER = "01M31EXNFWBGNQ3GQ5P8QYJM5P"
OTHER = "01M4T1GHYMP4V6835XJTZW620V"


def _task(path: Path, task_id: str, title: str) -> None:
    path.write_text(f"---\ntype: task\nid: {task_id}\ntitle: {title}\n---\n\nBody\n", encoding="utf-8")


def test_renames_the_file_the_id_the_attachments_and_the_references(tmp_path: Path) -> None:
    (tmp_path / "work" / "attachments" / OLD).mkdir(parents=True)
    (tmp_path / "work" / "attachments" / OLD / "a.png").write_bytes(b"png")
    _task(tmp_path / "work" / f"{OLD}.md", OLD, "Fix the Bug")
    _task(tmp_path / "work" / f"{NEWER}.md", NEWER, "Fix the bug")
    _task(tmp_path / "work" / f"{OTHER}.md", OTHER, "2024")
    _task(tmp_path / "work" / "existing.md", "existing", "Fix the bug")
    (tmp_path / "work" / "index.md").write_text("---\ntype: project\nid: work\n---\n", encoding="utf-8")
    (tmp_path / "timeblocks.json").write_text(json.dumps([{"id": "tb_1", "task_ids": [OLD, "x"]}]), encoding="utf-8")
    (tmp_path / "tasks.db").write_bytes(b"index")

    plan = script.plan_renames(tmp_path)
    assert plan[OLD][1] == "fix-the-bug"
    assert plan[NEWER][1].startswith("fix-the-bug-")
    script.apply_renames(tmp_path, plan)

    work = tmp_path / "work"
    assert "id: fix-the-bug\n" in (work / "fix-the-bug.md").read_text(encoding="utf-8")
    assert not (work / f"{OLD}.md").exists()
    assert (work / "attachments" / "fix-the-bug" / "a.png").read_bytes() == b"png"
    assert "id: '2024'\n" in (work / "2024.md").read_text(encoding="utf-8")
    assert json.loads((tmp_path / "timeblocks.json").read_text(encoding="utf-8"))[0]["task_ids"] == ["fix-the-bug", "x"]
    assert not (tmp_path / "tasks.db").exists()
    assert script.plan_renames(tmp_path) == {}


@pytest.mark.parametrize("title", ["Fix the Bug", "Äpfel über Öl, Straße", "été", "", "🎉", "a " * 50, "x" * 80])
def test_the_copy_of_the_slug_rules_matches_the_backend(title: str) -> None:
    assert script.task_slug(title) == task_slug(title)


@pytest.mark.parametrize(
    ("line", "title"),
    [
        ("title: Plain title", "Plain title"),
        ("title: 'It''s quoted'", "It's quoted"),
        ('title: "Say \\"hi\\"\\u00e9"', 'Say "hi"é'),
        ("title: a long\n  folded title", "a long folded title"),
    ],
)
def test_reads_the_title_without_yaml(line: str, title: str) -> None:
    assert script.read_title(f"---\ntype: task\n{line}\nstatus: todo\n---\n\nBody") == title
