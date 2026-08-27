"""Git subprocess synchronization and repository operations."""

import os
import re
import subprocess
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


def is_offline_error(err_str: str) -> bool:
    """Checks if a git error output indicates offline/network connectivity issues."""
    if not err_str:
        return False
    lower = err_str.lower()
    patterns = [
        "could not resolve host",
        "failed to connect",
        "connection refused",
        "network is unreachable",
        "operation timed out",
        "temporary failure in name resolution",
        "ssh: connect to host",
    ]
    return any(p in lower for p in patterns)


def is_git_installed() -> bool:
    """Checks if git CLI executable is available on PATH."""
    try:
        res = subprocess.run(["git", "--version"], capture_output=True, text=True, check=False)
        return res.returncode == 0
    except Exception:
        return False


def is_git_repo(project_dir: str) -> bool:
    """Checks if project_dir is a git repository."""
    git_dir = Path(project_dir) / ".git"
    return git_dir.is_dir()


def init_git_repo(project_dir: str) -> None:
    """Initializes a new Git repo with .gitignore."""
    p = Path(project_dir)
    p.mkdir(parents=True, exist_ok=True)
    if not is_git_repo(project_dir):
        subprocess.run(["git", "init", "-b", "main"], cwd=str(p), check=True, capture_output=True)

    gitignore = p / ".gitignore"
    if not gitignore.is_file():
        gitignore.write_text(".tempmediaStorage/\n*.tmp\n", encoding="utf-8")


def run_git(args: list[str], cwd: str | None = None) -> subprocess.CompletedProcess[str]:
    """Runs a git command in the specified directory."""
    return subprocess.run(
        ["git"] + args,
        cwd=cwd,
        capture_output=True,
        text=True,
        check=True,
    )


def git_commit(project_dir: str, message: str) -> bool:
    """Stages all changes and commits if there are changes."""
    if not is_git_repo(project_dir):
        init_git_repo(project_dir)

    p = str(Path(project_dir))

    # Configure local user if not set
    subprocess.run(["git", "config", "user.name", "Jotter"], cwd=p, check=False, capture_output=True)
    subprocess.run(
        ["git", "config", "user.email", "jotter@local"],
        cwd=p,
        check=False,
        capture_output=True,
    )

    # git add -A
    subprocess.run(["git", "add", "-A"], cwd=p, check=True, capture_output=True)

    # git status --porcelain
    status = subprocess.run(["git", "status", "--porcelain"], cwd=p, capture_output=True, text=True, check=True)
    if not status.stdout.strip():
        return False  # nothing to commit

    # Commit
    subprocess.run(["git", "commit", "-m", message], cwd=p, check=True, capture_output=True)
    return True


def git_sync(project_dir: str, remote_url: str | None) -> dict[str, Any] | None:
    """Commits local changes and synchronizes with git remote if configured."""
    if not remote_url:
        return None

    if not is_git_repo(project_dir):
        init_git_repo(project_dir)

    p = str(Path(project_dir))

    # Commit local changes first
    now_str = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
    git_commit(project_dir, f"jotter: auto-sync {now_str}")

    # Set or update remote
    subprocess.run(["git", "remote", "remove", "origin"], cwd=p, check=False, capture_output=True)
    subprocess.run(["git", "remote", "add", "origin", remote_url], cwd=p, check=True, capture_output=True)

    # Fetch and pull with rebase
    env = os.environ.copy()
    env["GIT_TERMINAL_PROMPT"] = "0"

    pull_res = subprocess.run(
        ["git", "pull", "--rebase", "origin", "main"],
        cwd=p,
        capture_output=True,
        text=True,
        env=env,
        check=False,
    )

    is_offline = False
    if pull_res.returncode != 0:
        if is_offline_error(pull_res.stderr):
            is_offline = True

    push_res = subprocess.run(
        ["git", "push", "-u", "origin", "main"],
        cwd=p,
        capture_output=True,
        text=True,
        env=env,
        check=False,
    )

    if push_res.returncode != 0:
        if is_offline_error(push_res.stderr):
            is_offline = True

    return {
        "success": pull_res.returncode == 0 and push_res.returncode == 0,
        "offline": is_offline,
        "error": pull_res.stderr or push_res.stderr if not is_offline else None,
    }


def get_git_history(project_dir: str, limit: int = 50) -> list[dict[str, str]]:
    """Returns the git commit history."""
    if not is_git_repo(project_dir):
        return []

    p = str(Path(project_dir))
    log_format = "%H%x1f%s%x1f%aI%x1f%an"
    res = subprocess.run(
        ["git", "log", f"-n{limit}", f"--pretty=format:{log_format}"],
        cwd=p,
        capture_output=True,
        text=True,
        check=False,
    )
    if res.returncode != 0 or not res.stdout.strip():
        return []

    history = []
    for line in res.stdout.strip().split("\n"):
        parts = line.split("\x1f")
        if len(parts) >= 4:
            history.append(
                {
                    "hash": parts[0],
                    "commit_hash": parts[0],
                    "message": parts[1],
                    "timestamp": parts[2],
                    "author": parts[3],
                }
            )
    return history


def git_restore(project_dir: str, commit_hash: str) -> None:
    """Restores the repository working tree to a specific commit hash."""
    if not commit_hash or not re.match(r"^[0-9a-fA-F]{4,40}$", commit_hash):
        raise ValueError(f"Invalid commit hash: '{commit_hash}'")

    if not is_git_repo(project_dir):
        raise FileNotFoundError(f"Project '{project_dir}' is not a git repository")

    p = str(Path(project_dir))

    # Commit any uncommitted changes first to avoid losing work
    git_commit(project_dir, f"jotter: save state before restore to {commit_hash}")

    # Checkout files from commit
    subprocess.run(["git", "checkout", commit_hash, "--", "."], cwd=p, check=True, capture_output=True)
    git_commit(project_dir, f"jotter: Restored to {commit_hash}")


def restore_commit(data_dir: str, project_id: str | None, commit_hash: str) -> None:
    """Restores project commit by project_id or data_dir."""
    target_dir = str(Path(data_dir) / project_id) if project_id else data_dir
    git_restore(target_dir, commit_hash)
