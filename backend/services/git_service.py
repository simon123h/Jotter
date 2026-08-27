import os
import shutil
import subprocess
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Optional, Tuple


OFFLINE_INDICATORS = [
    "could not resolve host",
    "could not resolve hostname",
    "failed to connect to",
    "connection refused",
    "connection timed out",
    "unable to access",
    "does not exist or is not a directory",
    "does not appear to be a git repository",
    "could not read from remote repository",
    "no route to host",
    "network is unreachable",
    "permission denied (publickey)",
    "fatal: '",
    "does not exist",
]


def is_offline_error(err_msg: str) -> bool:
    err_lower = err_msg.lower()
    return any(ind in err_lower for ind in OFFLINE_INDICATORS)


def run_git(args: List[str], cwd: str, timeout: int = 30) -> Tuple[bool, str, str]:
    try:
        proc = subprocess.run(
            ["git"] + args,
            cwd=cwd,
            capture_output=True,
            text=True,
            timeout=timeout,
        )
        return proc.returncode == 0, proc.stdout, proc.stderr
    except subprocess.TimeoutExpired:
        return False, "", f"git {' '.join(args)} timed out after {timeout}s"
    except Exception as e:
        return False, "", str(e)


def git_sync(project_dir: str, remote_url: Optional[str]) -> Optional[str]:
    p_path = Path(project_dir)
    p_path.mkdir(parents=True, exist_ok=True)

    if remote_url:
        remote_url = os.path.expanduser(remote_url)

    is_git = (p_path / ".git").is_dir()

    if not is_git and remote_url:
        # Check if remote has commits
        ok, out, _ = run_git(["ls-remote", "--heads", remote_url], cwd=project_dir, timeout=15)
        has_remote = ok and bool(out.strip())
        if has_remote:
            has_files = any(e.name not in [".", "..", ".git", ".gitignore"] for e in p_path.iterdir())
            if not has_files:
                run_git(["clone", remote_url, "."], cwd=project_dir)
            else:
                backup = p_path.parent / f"{p_path.name}-backup-{int(datetime.now().timestamp())}"
                p_path.rename(backup)
                p_path.mkdir(parents=True, exist_ok=True)
                run_git(["clone", remote_url, "."], cwd=project_dir)
                for item in backup.iterdir():
                    dst = p_path / item.name
                    if not dst.exists():
                        if item.is_dir():
                            shutil.copytree(str(item), str(dst))
                        else:
                            shutil.copy2(str(item), str(dst))
                shutil.rmtree(backup, ignore_errors=True)
        else:
            run_git(["init"], cwd=project_dir)
            run_git(["remote", "add", "origin", remote_url], cwd=project_dir)
        is_git = True

    if not is_git:
        return None

    if remote_url:
        ok_url, cur_url, _ = run_git(["remote", "get-url", "origin"], cwd=project_dir)
        if not ok_url:
            run_git(["remote", "add", "origin", remote_url], cwd=project_dir)
        elif cur_url.strip() != remote_url:
            run_git(["remote", "set-url", "origin", remote_url], cwd=project_dir)

    ok_remote, _, _ = run_git(["remote", "show", "origin"], cwd=project_dir)
    if not ok_remote:
        return None

    # Check dirty local changes
    ok_status, status_out, _ = run_git(["status", "--porcelain"], cwd=project_dir)
    if ok_status and status_out.strip():
        now_str = datetime.now(timezone.utc).isoformat()
        run_git(["add", "."], cwd=project_dir)
        run_git(["commit", "-m", f"Auto-sync from Jotter: {now_str}"], cwd=project_dir)

    # Fetch
    run_git(["fetch", "origin"], cwd=project_dir)

    # Get current branch
    ok_b, b_out, _ = run_git(["rev-parse", "--abbrev-ref", "HEAD"], cwd=project_dir)
    branch = b_out.strip() if ok_b and b_out.strip() != "HEAD" else "main"
    remote_branch = f"origin/{branch}"

    ok_has_rem, _, _ = run_git(["rev-parse", "--verify", remote_branch], cwd=project_dir)
    if ok_has_rem:
        ok_ff, _, _ = run_git(["merge", "--ff-only", remote_branch], cwd=project_dir)
        if not ok_ff:
            ok_reb, _, _ = run_git(["rebase", remote_branch], cwd=project_dir)
            if not ok_reb:
                run_git(["rebase", "--abort"], cwd=project_dir)
                ok_merge, _, _ = run_git(["merge", "--no-edit", remote_branch], cwd=project_dir)
                if not ok_merge:
                    run_git(["merge", "--abort"], cwd=project_dir)
                    return "merge conflict detected - please solve manually in project folder"

    # Push
    ok_push, _, err_push = run_git(["push", "origin", branch], cwd=project_dir)
    if not ok_push:
        if is_offline_error(err_push):
            return None
        return f"git push failed: {err_push}"

    return None


def get_git_history(tasks_dir: str, project_id: Optional[str] = None) -> List[Dict[str, str]]:
    repo_path = tasks_dir
    if project_id:
        proj_dir = Path(tasks_dir) / project_id
        if (proj_dir / ".git").is_dir():
            repo_path = str(proj_dir)

    if not (Path(repo_path) / ".git").is_dir():
        return []

    ok, out, _ = run_git(["log", "-n", "30", "--pretty=format:%H%x1f%an%x1f%aI%x1f%s"], cwd=repo_path)
    if not ok or not out.strip():
        return []

    commits: List[Dict[str, str]] = []
    for line in out.strip().split("\n"):
        parts = line.split("\x1f")
        if len(parts) >= 4:
            commits.append(
                {
                    "hash": parts[0],
                    "author": parts[1],
                    "date": parts[2],
                    "message": parts[3],
                }
            )
    return commits


def restore_commit(tasks_dir: str, project_id: Optional[str], commit_hash: str) -> None:
    repo_path = tasks_dir
    if project_id:
        proj_dir = Path(tasks_dir) / project_id
        if (proj_dir / ".git").is_dir():
            repo_path = str(proj_dir)

    if not (Path(repo_path) / ".git").is_dir():
        raise FileNotFoundError("Git repository not found for restore")

    # Safety backup commit
    ok_status, status_out, _ = run_git(["status", "--porcelain"], cwd=repo_path)
    if ok_status and status_out.strip():
        now_str = datetime.now(timezone.utc).isoformat()
        run_git(["add", "."], cwd=repo_path)
        run_git(["commit", "-m", f"Safety backup before restore: {now_str}"], cwd=repo_path)

    ok_co, _, err_co = run_git(["checkout", commit_hash, "--", "."], cwd=repo_path)
    if not ok_co:
        raise RuntimeError(f"Failed to restore files to commit {commit_hash}: {err_co}")

    now_str = datetime.now(timezone.utc).isoformat()
    run_git(["add", "."], cwd=repo_path)
    run_git(["commit", "-m", f"Restored project to snapshot {commit_hash[:7]} ({now_str})"], cwd=repo_path)
