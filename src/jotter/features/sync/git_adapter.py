"""Git subprocess synchronization and repository operations."""

import re
import subprocess
from collections.abc import Callable
from pathlib import Path, PurePosixPath

import yaml

from jotter.shared.exceptions import ValidationError

# Local-only runtime files that must never be versioned (SQLite index and its WAL/SHM sidecars)
LOCAL_EXCLUDES = ("tasks.db", "tasks.db-*")

# Maximum number of task titles listed in the body of an automatic commit message
MAX_LISTED_TASKS = 20


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


def _is_task_file(path: str) -> bool:
    """True for a task markdown file (`<project>/<id>.md`, or `<id>.md` in a project-level repo)."""
    p = PurePosixPath(path)
    return (
        len(p.parts) <= 2
        and p.suffix == ".md"
        and not p.name.startswith(".")
        and p.name.lower() not in ("index.md", "readme.md")
    )


def _task_verb(status: str) -> str:
    return {"A": "created", "D": "deleted"}.get(status, "modified")


def _parse_name_status(name_status: str) -> list[tuple[str, str]]:
    """Splits `git diff --name-status -z --no-renames` output into (status, path) pairs."""
    fields = name_status.split("\0")
    return list(zip(fields[0::2], fields[1::2]))


def summarize_changes(name_status: str) -> str:
    """Turns `git diff --cached --name-status -z --no-renames` output into a short commit subject.

    Example: "3 tasks created, 4 modified, 1 deleted, 2 other files changed".
    """
    tasks = {"created": 0, "modified": 0, "deleted": 0}
    other = 0
    for status, path in _parse_name_status(name_status):
        if _is_task_file(path):
            tasks[_task_verb(status)] += 1
        else:
            other += 1

    parts = []
    for verb, count in tasks.items():
        if not count:
            continue
        noun = f" task{'s' if count != 1 else ''}" if not parts else ""
        parts.append(f"{count}{noun} {verb}")
    if other:
        parts.append(f"{other} other file{'s' if other != 1 else ''} changed")
    return ", ".join(parts)


def _task_title(markdown: str, fallback: str) -> str:
    """Reads the `title` from a task's YAML frontmatter, collapsed to one line."""
    title = None
    parts = markdown.split("---", 2)
    if markdown.startswith("---") and len(parts) == 3:
        try:
            loaded = yaml.safe_load(parts[1])
        except yaml.YAMLError:
            loaded = None
        if isinstance(loaded, dict):
            title = loaded.get("title")
    return " ".join(str(title).split()) if title else fallback


def describe_changes(name_status: str, read_file: Callable[[str, bool], str]) -> str:
    """Lists the changed tasks by title, one `verb: title` line each, capped at MAX_LISTED_TASKS.

    `read_file(path, deleted)` returns the new content of a task file, or its last committed content when deleted.
    """
    order = ("created", "modified", "deleted")
    changes = sorted(
        ((_task_verb(status), path) for status, path in _parse_name_status(name_status) if _is_task_file(path)),
        key=lambda change: order.index(change[0]),
    )
    lines = []
    for verb, path in changes[:MAX_LISTED_TASKS]:
        try:
            content = read_file(path, verb == "deleted")
        except Exception:
            content = ""
        lines.append(f"{verb}: {_task_title(content, PurePosixPath(path).stem)}")
    if len(changes) > MAX_LISTED_TASKS:
        lines.append(f"... and {len(changes) - MAX_LISTED_TASKS} more")
    return "\n".join(lines)


def git_commit(project_dir: str | Path, message: str | None = None) -> bool:
    """Stages all changes and commits if there are changes. Does nothing outside a git repository.

    Without an explicit message, the subject summarizes the staged changes and the body lists the changed tasks.
    """
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

    args = ["commit", "-m"]
    if message is None:
        changes = run_git(["diff", "--cached", "--name-status", "-z", "--no-renames"], cwd=p, check=True).stdout

        def read_file(path: str, deleted: bool) -> str:
            return run_git(["show", f"{'HEAD' if deleted else ''}:{path}"], cwd=p, check=True).stdout

        args.append(f"jotter: {summarize_changes(changes)}")
        body = describe_changes(changes, read_file)
        if body:
            args.extend(["-m", body])
    else:
        args.append(message)

    res = run_git(args, cwd=p, check=False)
    return res.returncode == 0


def commit_changes(project_dir: str | Path) -> bool:
    """Commits local changes if project_dir is a git repository. Returns True if a commit was created."""
    return git_commit(project_dir)


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
