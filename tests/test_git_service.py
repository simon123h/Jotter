import subprocess
from pathlib import Path

from jotter.features.sync.git_adapter import (
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
    # Write a file in the repo
    file_path = Path(temp_dir) / "test.txt"
    file_path.write_text("hello", encoding="utf-8")

    # git_sync should commit changes locally and return None when remote is None
    res = git_sync(temp_dir, None)
    assert res is None

    # Check commit history contains auto-sync
    history = get_git_history(temp_dir)
    assert len(history) == 1
    assert "jotter: auto-sync" in history[0]["message"]


def test_git_history_and_restore_fallback_to_parent_repo(temp_dir):
    setup_git_data_dir(temp_dir)

    # Subdirectory project without its own .git
    proj_dir = Path(temp_dir) / "project-a"
    proj_dir.mkdir(parents=True, exist_ok=True)
    task_file = proj_dir / "task1.md"
    task_file.write_text("project A initial", encoding="utf-8")

    other_dir = Path(temp_dir) / "project-b"
    other_dir.mkdir(parents=True, exist_ok=True)
    other_file = other_dir / "task2.md"
    other_file.write_text("project B initial", encoding="utf-8")

    run_git(["add", "."], cwd=temp_dir)
    run_git(["commit", "-m", "commit for project A"], cwd=temp_dir)

    other_file.write_text("project B updated", encoding="utf-8")
    run_git(["add", "."], cwd=temp_dir)
    run_git(["commit", "-m", "commit exclusively for project B"], cwd=temp_dir)

    # 1. Project A should find history from parent git repo scoped to project-a
    history_a = get_git_history(proj_dir)
    assert len(history_a) >= 1
    # Should contain "commit for project A"
    assert any("commit for project A" in c["message"] for c in history_a)
    # Should NOT contain commits that only touched project B
    assert not any("exclusively for project B" in c["message"] for c in history_a)

    commit_a_hash = history_a[0]["hash"]

    # 2. Modify project A and test restore via parent repo
    task_file.write_text("project A modified v2", encoding="utf-8")
    run_git(["add", "."], cwd=temp_dir)
    run_git(["commit", "-m", "commit project A v2"], cwd=temp_dir)

    restore_commit(temp_dir, "project-a", commit_a_hash)
    assert task_file.read_text(encoding="utf-8") == "project A initial"
    # Project B's file should remain untouched
    assert other_file.read_text(encoding="utf-8") == "project B updated"


def test_git_sync_tracks_and_restores_canvas_files(temp_dir):
    setup_git_data_dir(temp_dir)

    proj_dir = Path(temp_dir) / "default"
    proj_dir.mkdir(parents=True, exist_ok=True)
    canvas_file = proj_dir / "architecture.canvas"
    canvas_file.write_text('{"nodes":[{"id":"node1","type":"text","text":"v1"}],"edges":[]}', encoding="utf-8")

    # git_sync auto-commits the canvas file
    git_sync(temp_dir, None)

    history = get_git_history(temp_dir)
    assert len(history) == 1
    v1_hash = history[0]["hash"]

    # Update canvas
    canvas_file.write_text('{"nodes":[{"id":"node1","type":"text","text":"v2"}],"edges":[]}', encoding="utf-8")
    git_sync(temp_dir, None)

    history_v2 = get_git_history(temp_dir)
    assert len(history_v2) == 2

    # Restore v1
    restore_commit(temp_dir, None, v1_hash)
    assert "v1" in canvas_file.read_text(encoding="utf-8")
