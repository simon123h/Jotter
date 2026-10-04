"""Git subprocess synchronization and repository operations."""

import re
import subprocess
from datetime import datetime, timezone
from pathlib import Path

from jotter.shared.exceptions import ValidationError

# Local-only runtime files that must never be versioned (SQLite index and its WAL/SHM sidecars)
LOCAL_EXCLUDES = ("tasks.db", "tasks.db-*")


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


def ensure_local_excludes(project_dir: str | Path) -> None:
    """Adds the local SQLite index to .git/info/exclude so it is never staged."""
    exclude_file = Path(project_dir) / ".git" / "info" / "exclude"
    existing = exclude_file.read_text(encoding="utf-8") if exclude_file.is_file() else ""
    missing = [pattern for pattern in LOCAL_EXCLUDES if pattern not in existing.splitlines()]
    if not missing:
        return
    exclude_file.parent.mkdir(parents=True, exist_ok=True)
    prefix = existing if not existing or existing.endswith("\n") else existing + "\n"
    exclude_file.write_text(prefix + "\n".join(missing) + "\n", encoding="utf-8")


def ensure_commit_identity(project_dir: str | Path) -> None:
    """Sets a repo-local fallback identity, but only for values git has not configured at any level."""
    for key, fallback in (("user.name", "Jotter"), ("user.email", "jotter@local")):
        res = run_git(["config", key], cwd=project_dir, check=False)
        if res.returncode != 0 or not res.stdout.strip():
            run_git(["config", "--local", key, fallback], cwd=project_dir, check=False)


def is_inside_git_work_tree(path: str | Path) -> bool:
    """Checks if path lies inside any git work tree (its own repository or an enclosing one)."""
    res = run_git(["rev-parse", "--is-inside-work-tree"], cwd=path, check=False)
    return res.returncode == 0 and res.stdout.strip() == "true"


def enable_git_versioning(project_dir: str | Path) -> bool:
    """Initializes a git repository in project_dir. Returns False if it already is one.

    Refuses to nest a new repository inside an enclosing one, or to run without git installed.
    """
    p = Path(project_dir)
    if not is_git_installed():
        raise ValidationError("Git is not installed or not available on PATH.")
    if is_git_repo(p):
        return False
    if is_inside_git_work_tree(p):
        raise ValidationError(
            f"'{p}' is already inside another Git repository. "
            "Use that repository directly or move the vault to its own folder."
        )
    init_git_repo(p)
    return True


def git_commit(project_dir: str | Path, message: str) -> bool:
    """Stages all changes and commits if there are changes. Does nothing outside a git repository."""
    p = Path(project_dir)
    if not is_git_repo(p):
        return False

    ensure_local_excludes(p)
    ensure_commit_identity(p)

    # Stage and check status
    run_git(["add", "-A"], cwd=p, check=True)
    status = run_git(["status", "--porcelain"], cwd=p, check=True)
    if not status.stdout.strip():
        return False

    staged_diff = run_git(["diff", "--cached", "--quiet"], cwd=p, check=False)
    if staged_diff.returncode == 0:
        return False

    res = run_git(["commit", "-m", message], cwd=p, check=False)
    return res.returncode == 0


def commit_changes(project_dir: str | Path, label: str = "commit") -> bool:
    """Commits local changes if project_dir is a git repository. Returns True if a commit was created."""
    p = Path(project_dir)
    if not is_git_repo(p):
        return False
    now_str = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
    return git_commit(p, f"jotter: {label} {now_str}")


def get_git_history(project_dir: str | Path, limit: int = 50) -> list[dict[str, str]]:
    """Returns the git commit history. Falls back to parent git repository if project_dir is not a git repo."""
    p = Path(project_dir)
    target_repo = p
    scoped_path: str | None = None

    if not is_git_repo(p):
        parent = p.parent
        if is_git_repo(parent):
            target_repo = parent
            scoped_path = p.name
        else:
            return []

    log_format = "%H%x1f%s%x1f%aI%x1f%an"
    cmd = ["log", f"-n{limit}", f"--pretty=format:{log_format}"]
    if scoped_path:
        cmd.extend(["--", scoped_path])

    res = run_git(cmd, cwd=target_repo, check=False)
    if res.returncode != 0 or not res.stdout.strip():
        return []

    history = []
    for line in res.stdout.strip().split("\n"):
        parts = line.split("\x1f")
        if len(parts) >= 4:
            commit_id = parts[0]
            history.append(
                {
                    "id": commit_id,
                    "short_id": commit_id[:7],
                    "hash": commit_id,
                    "commit_hash": commit_id,
                    "message": parts[1],
                    "date": parts[2],
                    "timestamp": parts[2],
                    "author": parts[3],
                }
            )
    return history


def git_restore(project_dir: str | Path, commit_hash: str) -> None:
    """Restores the repository working tree to a specific commit hash.

    If project_dir is not its own git repo but its parent is, restores only that project's directory in the parent repo.
    """
    if not commit_hash or not re.match(r"^[0-9a-fA-F]{4,40}$", commit_hash):
        raise ValueError(f"Invalid commit hash: '{commit_hash}'")

    p = Path(project_dir)
    target_repo = p
    scoped_path = "."

    if not is_git_repo(p):
        parent = p.parent
        if is_git_repo(parent):
            target_repo = parent
            scoped_path = p.name
        else:
            raise FileNotFoundError(f"Project '{project_dir}' is not a git repository and has no parent git repository")

    # Commit any uncommitted changes first to avoid losing work
    git_commit(target_repo, f"jotter: save state before restore to {commit_hash}")

    # Checkout files from commit
    run_git(["checkout", commit_hash, "--", scoped_path], cwd=target_repo, check=True)
    git_commit(target_repo, f"jotter: Restored to {commit_hash}")


def restore_commit(data_dir: str, project_id: str | None, commit_hash: str) -> None:
    """Restores project commit by project_id or data_dir."""
    target_dir = Path(data_dir) / project_id if project_id else Path(data_dir)
    git_restore(target_dir, commit_hash)
