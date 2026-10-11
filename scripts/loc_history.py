#!/usr/bin/env python3
"""Counts lines of code (LOC) per area across the commit history, without checking anything out.

    python3 scripts/loc_history.py            # writes loc_history.txt, one row per commit
    python3 scripts/loc_history.py --current  # prints the table for the latest commit only

An area is a part of the repository: the backend, the web app, the mobile app, the shared packages. Code and test
lines are counted apart. The areas follow the paths of today and of the earlier layouts (frontend/, web/, mobile/).
Plot the result with scripts/plot_loc.py.
"""

import re
import subprocess
import sys
import time
from collections.abc import Callable

AREAS = ("backend", "web", "mobile", "packages", "other")

EXCLUDED_PATHS = (
    "node_modules/",
    "/node_modules/",
    "dist/",
    "/dist/",
    "coverage/",
    "/coverage/",
    "venv/",
    "/venv/",
    ".git/",
    "/.git/",
    ".github/",
    "/.github/",
)

SOURCE_EXTENSIONS = (".go", ".py", ".ts", ".vue", ".css")

# A file counts as test code if any of these match its path
TEST_PATH_PATTERN = re.compile(
    r"(^|/)(tests?|__tests__|e2e)/"  # test directories
    r"|(^|/)(test_[^/]*\.py|conftest\.py|test-setup\.ts)$"  # Python test modules and shared setup
    r"|\.(spec|test)\.(ts|vue)$"  # frontend test files
)

# The first matching prefix decides, so that the layouts of every period of the history are covered
AREA_PREFIXES = (
    ("apps/web/", "web"),
    ("web/", "web"),
    ("frontend/", "web"),
    ("apps/mobile/", "mobile"),
    ("mobile/", "mobile"),
    ("packages/", "packages"),
    ("src/", "backend"),
    ("tests/", "backend"),
    ("backend/", "backend"),
    ("cmd/", "backend"),
    ("internal/", "backend"),
    ("pkg/", "backend"),
    ("scripts/", "other"),
    ("docs/", "other"),
)


def is_excluded(path: str) -> bool:
    if path.endswith(".d.ts"):
        return True
    return any(p in path or path.startswith(p.lstrip("/")) for p in EXCLUDED_PATHS)


def is_test(path: str) -> bool:
    return TEST_PATH_PATTERN.search(path) is not None


def area_of(path: str) -> str:
    for prefix, area in AREA_PREFIXES:
        if path.startswith(prefix):
            return area
    # Loose files at the root (main.go, run.py) belong to the backend
    return "backend" if "/" not in path and path.endswith((".go", ".py")) else "other"


Counts = dict[tuple[str, str], int]


def count_tree(tree_output: str, blob_lines: Callable[[str], int]) -> Counts:
    """Lines per (area, "code" or "test") for the output of `git ls-tree -r`."""
    counts: Counts = {(area, kind): 0 for area in AREAS for kind in ("code", "test")}
    for entry in tree_output.split("\n"):
        if not entry or "\t" not in entry:
            continue
        meta, path = entry.split("\t", 1)
        if is_excluded(path) or not path.endswith(SOURCE_EXTENSIONS):
            continue
        parts = meta.split()
        if len(parts) < 3:
            continue
        counts[(area_of(path), "test" if is_test(path) else "code")] += blob_lines(parts[2])
    return counts


def header() -> str:
    columns = ["Date", "Commit", "Code_LOC", "Test_LOC", "Total_LOC"]
    columns += [f"{area}_{kind}" for area in AREAS for kind in ("code", "test")]
    return ",".join(columns)


def row(date: str, commit: str, counts: Counts) -> str:
    code = sum(v for (_, kind), v in counts.items() if kind == "code")
    test = sum(v for (_, kind), v in counts.items() if kind == "test")
    values = [date, commit, code, test, code + test]
    values += [counts[(area, kind)] for area in AREAS for kind in ("code", "test")]
    return ",".join(str(v) for v in values)


def print_table(counts: Counts) -> None:
    print(f"{'area':<10}{'code':>9}{'tests':>9}{'total':>9}")
    for area in AREAS:
        code, test = counts[(area, "code")], counts[(area, "test")]
        print(f"{area:<10}{code:>9}{test:>9}{code + test:>9}")
    code = sum(v for (_, kind), v in counts.items() if kind == "code")
    test = sum(v for (_, kind), v in counts.items() if kind == "test")
    print(f"{'all':<10}{code:>9}{test:>9}{code + test:>9}")


class BlobReader:
    """Line counts of git blobs through one `git cat-file --batch` process, cached by blob id."""

    def __init__(self) -> None:
        self.cache: dict[str, int] = {}
        self.proc = subprocess.Popen(["git", "cat-file", "--batch"], stdin=subprocess.PIPE, stdout=subprocess.PIPE)

    def lines(self, sha: str) -> int:
        if sha in self.cache:
            return self.cache[sha]
        assert self.proc.stdin is not None
        assert self.proc.stdout is not None
        self.proc.stdin.write(f"{sha}\n".encode())
        self.proc.stdin.flush()
        parts = self.proc.stdout.readline().decode().split()
        if len(parts) < 3 or parts[1] != "blob":
            self.cache[sha] = 0
            return 0
        content = self.proc.stdout.read(int(parts[2]))
        self.proc.stdout.read(1)  # Trailing newline after a batch item
        lines = content.count(b"\n") + (1 if content and not content.endswith(b"\n") else 0)
        self.cache[sha] = lines
        return lines

    def close(self) -> None:
        self.proc.terminate()


def ls_tree(commit: str) -> str:
    return subprocess.check_output(["git", "ls-tree", "-r", commit], text=True).strip()


def count_current() -> None:
    reader = BlobReader()
    try:
        print_table(count_tree(ls_tree("HEAD"), reader.lines))
    finally:
        reader.close()


def count_loc_history(output_file: str = "loc_history.txt") -> None:
    start_time = time.time()
    print("Calculating LOC history per area (in-memory git tree traversal)...")

    # All commits in chronological order by committer date
    commits_raw = subprocess.check_output(
        ["git", "log", "--reverse", "--pretty=format:%H|%cd", "--date=short"], text=True
    ).strip()
    if not commits_raw:
        print("No commits found.")
        return
    commits = [line.split("|", 1) for line in commits_raw.split("\n") if "|" in line]

    reader = BlobReader()
    rows = []
    try:
        for idx, (commit_hash, commit_date) in enumerate(commits, 1):
            if idx % 50 == 0 or idx == len(commits):
                print(f"[{idx}/{len(commits)}] Processing commit {commit_hash[:7]} ({commit_date})...")
            rows.append(row(commit_date, commit_hash[:7], count_tree(ls_tree(commit_hash), reader.lines)))
    finally:
        reader.close()

    with open(output_file, "w", encoding="utf-8") as f:
        f.write(header() + "\n")
        f.write("\n".join(rows) + "\n")
    print(f"Done in {time.time() - start_time:.2f}s! LOC history written to {output_file}")


if __name__ == "__main__":
    if "--current" in sys.argv[1:]:
        count_current()
    else:
        count_loc_history()
