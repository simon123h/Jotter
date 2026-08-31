#!/usr/bin/env python3
"""Calculates lines of code (LOC) across repository commit history without git checkout."""

import os
import subprocess
import sys
import time

EXCLUDED_PATHS = (
    "node_modules/",
    "/node_modules/",
    "dist/",
    "/dist/",
    "venv/",
    "/venv/",
    ".git/",
    "/.git/",
    ".github/",
    "/.github/",
)

BACKEND_EXTENSIONS = (".go", ".py")
FRONTEND_EXTENSIONS = (".ts", ".vue", ".css")


def is_excluded(path: str) -> bool:
    if path.endswith(".d.ts"):
        return True
    return any(p in path or path.startswith(p.lstrip("/")) for p in EXCLUDED_PATHS)


def count_loc_history(output_file: str = "loc_history.txt") -> None:
    start_time = time.time()
    print("Calculating LOC history (in-memory git tree traversal)...")

    # Get all commits in chronological order by committer date
    commits_raw = subprocess.check_output(
        ["git", "log", "--reverse", "--pretty=format:%H|%cd", "--date=short"],
        text=True,
    ).strip()

    if not commits_raw:
        print("No commits found.")
        return

    commits = [line.split("|", 1) for line in commits_raw.split("\n") if "|" in line]
    total_commits = len(commits)

    # Blob SHA -> line count cache (deduplicates identical file contents across commits)
    blob_cache: dict[str, int] = {}

    cat_proc = subprocess.Popen(
        ["git", "cat-file", "--batch"],
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        text=False,
    )

    def get_blob_lines(sha: str) -> int:
        if sha in blob_cache:
            return blob_cache[sha]
        assert cat_proc.stdin is not None
        assert cat_proc.stdout is not None
        cat_proc.stdin.write(f"{sha}\n".encode())
        cat_proc.stdin.flush()
        header = cat_proc.stdout.readline().decode()
        parts = header.split()
        if len(parts) < 3 or parts[1] != "blob":
            blob_cache[sha] = 0
            return 0
        size = int(parts[2])
        content = cat_proc.stdout.read(size)
        cat_proc.stdout.read(1)  # Trailing newline after batch item
        lines = content.count(b"\n")
        if content and not content.endswith(b"\n"):
            lines += 1
        blob_cache[sha] = lines
        return lines

    results = []

    try:
        for idx, (commit_hash, commit_date) in enumerate(commits, 1):
            if idx % 50 == 0 or idx == total_commits:
                print(f"[{idx}/{total_commits}] Processing commit {commit_hash[:7]} ({commit_date})...")

            tree_output = subprocess.check_output(
                ["git", "ls-tree", "-r", commit_hash],
                text=True,
            ).strip()

            backend_loc = 0
            frontend_loc = 0

            if tree_output:
                for entry in tree_output.split("\n"):
                    if not entry:
                        continue
                    meta, path = entry.split("\t", 1)
                    if is_excluded(path):
                        continue

                    parts = meta.split()
                    if len(parts) < 3:
                        continue
                    sha = parts[2]

                    if path.endswith(BACKEND_EXTENSIONS):
                        backend_loc += get_blob_lines(sha)
                    elif path.endswith(FRONTEND_EXTENSIONS):
                        frontend_loc += get_blob_lines(sha)

            total_loc = backend_loc + frontend_loc
            results.append(f"{commit_date},{commit_hash[:7]},{backend_loc},{frontend_loc},{total_loc}")

    finally:
        cat_proc.terminate()

    with open(output_file, "w", encoding="utf-8") as f:
        f.write("Date,Commit,Backend_LOC,TS_Vue_CSS_LOC,Total_LOC\n")
        f.write("\n".join(results) + "\n")

    elapsed = time.time() - start_time
    print(f"Done in {elapsed:.2f}s! LOC history written to {output_file}")


if __name__ == "__main__":
    count_loc_history()
