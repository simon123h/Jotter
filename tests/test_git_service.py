import subprocess
from pathlib import Path

from jotter.services.git_service import (
    get_git_history,
    git_sync,
    is_offline_error,
    restore_commit,
    run_git,
)


def setup_git_data_dir(temp_dir: str):
    p = Path(temp_dir)
    p.mkdir(parents=True, exist_ok=True)
    subprocess.run(["git", "init"], cwd=temp_dir, check=True, capture_output=True)
    subprocess.run(["git", "config", "user.name", "Test User"], cwd=temp_dir, check=True)
    subprocess.run(["git", "config", "user.email", "test@example.com"], cwd=temp_dir, check=True)


def test_offline_error_detection():
    assert is_offline_error("fatal: unable to access 'https://github.com/...': Could not resolve host")
    assert is_offline_error("ssh: connect to host github.com port 22: Connection refused")
    assert not is_offline_error("syntax error in commit message")


def test_git_commit_and_history(temp_dir):
    setup_git_data_dir(temp_dir)

    proj_dir = Path(temp_dir) / "default"
    proj_dir.mkdir(parents=True, exist_ok=True)
    task_file = proj_dir / "task1.md"
    task_file.write_text("initial content", encoding="utf-8")

    run_git(["add", "."], cwd=temp_dir)
    run_git(["commit", "-m", "Create initial task"], cwd=temp_dir)

    history = get_git_history(temp_dir)
    assert len(history) >= 1
    assert "Create initial task" in history[0]["message"]
    assert history[0]["hash"] != ""


def test_git_restore_commit(temp_dir):
    setup_git_data_dir(temp_dir)

    proj_dir = Path(temp_dir) / "default"
    proj_dir.mkdir(parents=True, exist_ok=True)
    task_file = proj_dir / "task1.md"
    task_file.write_text("v1 content", encoding="utf-8")

    run_git(["add", "."], cwd=temp_dir)
    run_git(["commit", "-m", "v1 commit"], cwd=temp_dir)

    history_v1 = get_git_history(temp_dir)
    v1_hash = history_v1[0]["hash"]

    # Modify file to v2
    task_file.write_text("v2 modified content", encoding="utf-8")
    run_git(["add", "."], cwd=temp_dir)
    run_git(["commit", "-m", "v2 commit"], cwd=temp_dir)

    assert task_file.read_text(encoding="utf-8") == "v2 modified content"

    # Restore v1
    restore_commit(temp_dir, None, v1_hash)
    assert task_file.read_text(encoding="utf-8") == "v1 content"

    # Verify restore commit was created
    history_after = get_git_history(temp_dir)
    assert any("Restored" in c["message"] for c in history_after)


def test_git_sync_no_remote(temp_dir):
    setup_git_data_dir(temp_dir)
    # git_sync should succeed without error when remote is None
    res = git_sync(temp_dir, None)
    assert res is None
