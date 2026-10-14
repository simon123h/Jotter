#!/usr/bin/env python3
"""Gives the tasks of an old vault that are still named by a ULID a file name from their title.

    python3 scripts/rename_ulid_tasks.py <vault>           # dry run: prints what would be renamed
    python3 scripts/rename_ulid_tasks.py <vault> --apply   # renames

Before `--apply`: stop the Jotter backend, and let every device (the Android app, other machines) sync, so that
none of them still edits a task under its old name. A task's id is its file name (spec/FORMAT.md), so the script
changes it everywhere the old one is mentioned:

- the file `<project>/<ULID>.md` and its `id:` line,
- the attachments folder `<project>/attachments/<ULID>/`,
- every `.md`, `.canvas` and `.json` file of the vault that contains the ULID (time blocks, links, canvases).

The new names follow the rules for new tasks (a copy of `jotter.shared.slug`): the slug of the title, a random suffix when
the name is taken anywhere in the vault. The oldest task gets the bare slug. Afterwards the script deletes the
search index (`tasks.db`); the backend builds it again when it starts. Commit the result in the vault's Git repo
(`git add -A`, Git sees the renames).
"""

import argparse
import json
import re
import secrets
import sys
import unicodedata
from collections.abc import Callable
from pathlib import Path

ULID = re.compile(r"[0-9A-HJKMNP-TV-Z]{26}", re.IGNORECASE)
TEXT_SUFFIXES = {".md", ".canvas", ".json"}
INDEX_FILES = ("tasks.db", "tasks.db-shm", "tasks.db-wal")

# The file names of new tasks: a copy of src/jotter/shared/slug.py (spec/FORMAT.md, "File names of new tasks"),
# so that this script runs on its own, with nothing but Python 3.9 or newer
_SPELLED_OUT = str.maketrans(
    {"ä": "ae", "ö": "oe", "ü": "ue", "ß": "ss", "æ": "ae", "œ": "oe", "ø": "o", "ł": "l", "đ": "d"}
)
_MAX_TASK_SLUG = 60
_SUFFIX_ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789"
RESERVED_TASK_NAMES = frozenset(
    {"index", "readme", "con", "prn", "aux", "nul"}
    | {f"com{n}" for n in range(1, 10)}
    | {f"lpt{n}" for n in range(1, 10)}
)
# YAML 1.1 reads these plain words as booleans or null
_YAML_WORDS = frozenset({"y", "n", "yes", "no", "on", "off", "true", "false", "null"})
_FRONTMATTER = re.compile(r"\A---[ \t]*\r?\n(.*?)^---[ \t]*(?:\r?\n|\Z)", re.DOTALL | re.MULTILINE)


def task_slug(title: str) -> str:
    text = title.lower().translate(_SPELLED_OUT)
    text = "".join(c for c in unicodedata.normalize("NFKD", text) if not unicodedata.combining(c))
    text = re.sub(r"[^a-z0-9]+", "-", text).strip("-")
    if len(text) > _MAX_TASK_SLUG:
        cut = text[: _MAX_TASK_SLUG + 1].rfind("-")
        text = text[:cut] if cut > 0 else text[:_MAX_TASK_SLUG]
    return text or "task"


def unique_task_name(slug: str, is_taken: Callable[[str], bool]) -> str:
    name = slug
    while name in RESERVED_TASK_NAMES or is_taken(name):
        name = f"{slug}-{''.join(secrets.choice(_SUFFIX_ALPHABET) for _ in range(4))}"
    return name


def read_title(content: str) -> str:
    """The `title:` of the frontmatter. Reads the plain, the quoted and the folded (several lines) forms."""
    match = _FRONTMATTER.match(content)
    if not match:
        return ""
    lines = match.group(1).splitlines()
    for i, line in enumerate(lines):
        if not line.startswith("title:"):
            continue
        parts = [line[len("title:") :].strip()]
        for follow in lines[i + 1 :]:
            if not follow.startswith((" ", "\t")):
                break
            parts.append(follow.strip())
        value = " ".join(p for p in parts if p)
        if value[:1] == "'" and value[-1:] == "'" and len(value) > 1:
            return value[1:-1].replace("''", "'")
        if value[:1] == '"' and value[-1:] == '"' and len(value) > 1:
            try:
                return str(json.loads(value))
            except ValueError:
                return value[1:-1]
        return value
    return ""


def _project_dirs(vault: Path) -> list[Path]:
    return sorted(p for p in vault.iterdir() if p.is_dir() and not p.name.startswith("."))


def _task_files(project: Path) -> list[Path]:
    return sorted(
        p
        for p in project.glob("*.md")
        if p.is_file() and p.name.lower() not in ("index.md", "readme.md") and not p.name.startswith(".")
    )


def _title(path: Path) -> str:
    return read_title(path.read_text(encoding="utf-8"))


def plan_renames(vault: Path) -> dict[str, tuple[Path, str]]:
    """Maps each ULID to (its file, its new name). The oldest task (ULIDs sort by time) gets the bare slug."""
    taken: set[str] = set()
    ulids: list[tuple[str, Path]] = []
    for project in _project_dirs(vault):
        for path in _task_files(project):
            if ULID.fullmatch(path.stem):
                ulids.append((path.stem.upper(), path))
            else:
                taken.add(path.stem.lower())
    plan: dict[str, tuple[Path, str]] = {}
    for old, path in sorted(ulids):
        name = unique_task_name(task_slug(_title(path)), lambda n: n.lower() in taken)
        taken.add(name.lower())
        plan[old] = (path, name)
    return plan


def _id_line(name: str) -> str:
    """`id: <name>`, quoted when YAML could read the name as a number, a date, a boolean or the like."""
    plain = re.fullmatch(r"[a-z][a-z0-9-]*", name) and name not in _YAML_WORDS
    return f"id: {name}" if plain else f"id: '{name}'"


def apply_renames(vault: Path, plan: dict[str, tuple[Path, str]]) -> None:
    new_names = {old: name for old, (_, name) in plan.items()}
    pattern = re.compile("|".join(new_names), re.IGNORECASE)

    def replace(match: re.Match[str]) -> str:
        return new_names[match.group(0).upper()]

    # 1. every mention of an old id, in the files that can hold one
    for path in vault.rglob("*"):
        if ".git" in path.relative_to(vault).parts or path.suffix not in TEXT_SUFFIXES or not path.is_file():
            continue
        text = path.read_text(encoding="utf-8")
        changed = pattern.sub(replace, text)
        if changed != text:
            path.write_text(changed, encoding="utf-8", newline="")

    # 2. the files and attachment folders; the `id:` line gets quotes where YAML needs them
    for old, (path, name) in plan.items():
        content = path.read_text(encoding="utf-8")
        content = re.sub(r"(?m)^id:[ \t]*['\"]?" + re.escape(name) + r"['\"]?[ \t]*$", _id_line(name), content, count=1)
        path.write_text(content, encoding="utf-8", newline="")
        path.rename(path.with_name(f"{name}.md"))
        attachments = path.parent / "attachments"
        for folder in attachments.glob("*") if attachments.is_dir() else ():
            if folder.is_dir() and folder.name.upper() == old:
                folder.rename(attachments / name)

    # 3. the index is derived; the backend builds it again
    for name in INDEX_FILES:
        (vault / name).unlink(missing_ok=True)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("vault", type=Path)
    parser.add_argument("--apply", action="store_true", help="rename (without it, only print the plan)")
    args = parser.parse_args()

    vault: Path = args.vault
    if not vault.is_dir():
        print(f"{vault} is not a folder", file=sys.stderr)
        return 1
    plan = plan_renames(vault)
    for old, (path, name) in plan.items():
        print(f"{path.parent.name}/{old} -> {name}")
    print(f"{len(plan)} tasks {'renamed' if args.apply else 'would be renamed'}")
    if args.apply and plan:
        apply_renames(vault, plan)
    elif plan:
        print("Dry run. Run again with --apply (backend stopped, devices synced).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
