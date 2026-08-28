"""Git subprocess synchronization and repository operations."""

import os
import re
import subprocess
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

OFFLINE_ERROR_PATTERNS = (
    "could not resolve host",
    "failed to connect",
    "connection refused",
    "network is unreachable",
    "operation timed out",
    "temporary failure in name resolution",
    "ssh: connect to host",
)


def run_git(
    args: list[str],
    cwd: str | Path | None = None,
    check: bool = True,
    env: dict[str, str] | None = None,
) -> subprocess.CompletedProcess[str]:
    """Runs a git command in the specified directory."""
    return subprocess.run(
        ["git", *args],
        cwd=str(cwd) if cwd else None,
        capture_output=True,
        text=True,
        check=check,
        env=env,
    )


def is_offline_error(err_str: str) -> bool:
    """Checks if a git error output indicates offline/network connectivity issues."""
    if not err_str:
        return False
    lower = err_str.lower()
    return any(p in lower for p in OFFLINE_ERROR_PATTERNS)


def is_git_installed() -> bool:
    """Checks if git CLI executable is available on PATH."""
    try:
        res = run_git(["--version"], check=False)
        return res.returncode == 0
    except Exception:
        return False


def is_git_repo(project_dir: str | Path) -> bool:
    """Checks if project_dir is a git repository."""
    return (Path(project_dir) / ".git").is_dir()


def init_git_repo(project_dir: str | Path) -> None:
    """Initializes a new Git repo with .gitignore."""
    p = Path(project_dir)
    p.mkdir(parents=True, exist_ok=True)
    if not is_git_repo(p):
        run_git(["init", "-b", "main"], cwd=p, check=True)

    gitignore = p / ".gitignore"
    if not gitignore.is_file():
        gitignore.write_text(".tempmediaStorage/\n*.tmp\n", encoding="utf-8")


def git_commit(project_dir: str | Path, message: str) -> bool:
    """Stages all changes and commits if there are changes."""
    p = Path(project_dir)
    if not is_git_repo(p):
        init_git_repo(p)

    # Configure local user if not set
    run_git(["config", "user.name", "Jotter"], cwd=p, check=False)
    run_git(["config", "user.email", "jotter@local"], cwd=p, check=False)

    # Stage and check status
    run_git(["add", "-A"], cwd=p, check=True)
    status = run_git(["status", "--porcelain"], cwd=p, check=True)
    if not status.stdout.strip():
        return False  # nothing to commit

    run_git(["commit", "-m", message], cwd=p, check=True)
    return True


def git_sync(project_dir: str | Path, remote_url: str | None) -> dict[str, Any] | None:
    """Commits local changes and synchronizes with git remote if configured."""
    if not remote_url:
        return None

    p = Path(project_dir)
    if not is_git_repo(p):
        init_git_repo(p)

    # Commit local changes first
    now_str = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
    git_commit(p, f"jotter: auto-sync {now_str}")

    # Set or update remote
    run_git(["remote", "remove", "origin"], cwd=p, check=False)
    run_git(["remote", "add", "origin", remote_url], cwd=p, check=True)

    # Fetch and pull with rebase
    env = os.environ.copy()
    env["GIT_TERMINAL_PROMPT"] = "0"

    pull_res = run_git(["pull", "--rebase", "origin", "main"], cwd=p, check=False, env=env)
    is_offline = pull_res.returncode != 0 and is_offline_error(pull_res.stderr)

    push_res = run_git(["push", "-u", "origin", "main"], cwd=p, check=False, env=env)
    if push_res.returncode != 0 and is_offline_error(push_res.stderr):
        is_offline = True

    return {
        "success": pull_res.returncode == 0 and push_res.returncode == 0,
        "offline": is_offline,
        "error": pull_res.stderr or push_res.stderr if not is_offline else None,
    }


def get_git_history(project_dir: str | Path, limit: int = 50) -> list[dict[str, str]]:
    """Returns the git commit history."""
    p = Path(project_dir)
    if not is_git_repo(p):
        return []

    log_format = "%H%x1f%s%x1f%aI%x1f%an"
    res = run_git(["log", f"-n{limit}", f"--pretty=format:{log_format}"], cwd=p, check=False)
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


def git_restore(project_dir: str | Path, commit_hash: str) -> None:
    """Restores the repository working tree to a specific commit hash."""
    if not commit_hash or not re.match(r"^[0-9a-fA-F]{4,40}$", commit_hash):
        raise ValueError(f"Invalid commit hash: '{commit_hash}'")

    p = Path(project_dir)
    if not is_git_repo(p):
        raise FileNotFoundError(f"Project '{project_dir}' is not a git repository")

    # Commit any uncommitted changes first to avoid losing work
    git_commit(p, f"jotter: save state before restore to {commit_hash}")

    # Checkout files from commit
    run_git(["checkout", commit_hash, "--", "."], cwd=p, check=True)
    git_commit(p, f"jotter: Restored to {commit_hash}")


def restore_commit(data_dir: str, project_id: str | None, commit_hash: str) -> None:
    """Restores project commit by project_id or data_dir."""
    target_dir = Path(data_dir) / project_id if project_id else Path(data_dir)
    git_restore(target_dir, commit_hash)
