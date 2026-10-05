import os
import time
from pathlib import Path

from fastapi.testclient import TestClient

from jotter.app import create_app
from jotter.config import UserConfig
from jotter.features.sync.git_adapter import get_git_history, run_git
from jotter.features.sync.scheduler import VaultSyncScheduler, commit_vault, sync_vault


class Harness:
    """Scheduler with recording sync and commit functions; cycles are driven by hand."""

    def __init__(self, tmp_path, changed=False, **kwargs):
        self.syncs = 0
        self.commits = 0
        self.changed = changed
        self.sync_error: Exception | None = None
        self.commit_error: Exception | None = None

        def sync_fn(_dir):
            self.syncs += 1
            if self.sync_error:
                raise self.sync_error
            return self.changed

        def commit_fn(_dir):
            self.commits += 1
            if self.commit_error:
                raise self.commit_error
            return True

        self.scheduler = VaultSyncScheduler(tmp_path, sync_fn=sync_fn, commit_fn=commit_fn, **kwargs)


def test_idle_cycle_syncs_but_does_not_commit(tmp_path):
    h = Harness(tmp_path)
    h.scheduler.run_once()
    assert (h.syncs, h.commits) == (1, 0)


def test_cycle_commits_after_api_change(tmp_path):
    h = Harness(tmp_path)
    h.scheduler.mark_dirty()
    h.scheduler.run_once()
    assert h.commits == 1

    h.scheduler.run_once()  # the dirty flag was consumed
    assert h.commits == 1


def test_cycle_commits_when_the_sync_saw_changes(tmp_path):
    h = Harness(tmp_path, changed=True)
    h.scheduler.run_once()
    assert h.commits == 1


def test_git_is_checked_every_nth_cycle_even_when_idle(tmp_path):
    h = Harness(tmp_path, verify_every=3)
    for _ in range(6):
        h.scheduler.run_once()
    assert h.commits == 2


def test_failing_sync_does_not_stop_the_cycle(tmp_path):
    h = Harness(tmp_path)
    h.sync_error = RuntimeError("db locked")
    h.scheduler.mark_dirty()
    h.scheduler.run_once()
    assert h.commits == 1


def test_failed_commit_is_retried_next_cycle(tmp_path):
    h = Harness(tmp_path)
    h.commit_error = RuntimeError("git missing")
    h.scheduler.mark_dirty()
    h.scheduler.run_once()
    h.commit_error = None
    h.scheduler.run_once()
    assert h.commits == 2


def test_flush_commits_pending_changes_only(tmp_path):
    h = Harness(tmp_path)
    h.scheduler.flush()
    assert h.commits == 0
    h.scheduler.mark_dirty()
    h.scheduler.flush()
    assert h.commits == 1


def test_retarget_flushes_old_vault_and_follows_the_new_one(tmp_path):
    seen = []
    scheduler = VaultSyncScheduler(
        tmp_path / "a",
        sync_fn=lambda d: seen.append(("sync", d)) or False,
        commit_fn=lambda d: seen.append(("commit", d)),
    )
    scheduler.mark_dirty()
    scheduler.retarget(tmp_path / "b")
    scheduler.run_once()
    assert seen == [("commit", tmp_path / "a"), ("sync", tmp_path / "b")]


def test_background_thread_runs_cycles_and_flushes_on_stop(tmp_path):
    h = Harness(tmp_path, interval_seconds=0.02)
    h.scheduler.start()
    deadline = time.time() + 3
    while h.syncs < 2 and time.time() < deadline:
        time.sleep(0.01)
    h.scheduler.mark_dirty()
    h.scheduler.stop()
    assert h.syncs >= 2
    assert h.commits >= 1  # the pending change was committed by the final flush
    syncs = h.syncs
    time.sleep(0.1)
    assert h.syncs == syncs  # the thread is gone


def test_sync_vault_reports_whether_task_files_changed(temp_dir):
    vault = Path(temp_dir)
    (vault / "default").mkdir()
    task = vault / "default" / "a.md"
    task.write_text(
        "---\ntype: task\nid: a\nproject_id: default\ntitle: A\nstatus: todo\nposition: 1000.0\n---\n", encoding="utf-8"
    )
    old = time.time() - 3600
    os.utime(task, (old, old))

    assert sync_vault(vault) is True  # first sight of the file
    assert sync_vault(vault) is False  # unchanged, skipped by its stat
    task.write_text(task.read_text(encoding="utf-8").replace("title: A", "title: B"), encoding="utf-8")
    os.utime(task, (old - 100, old - 100))
    assert sync_vault(vault) is True
    task.unlink()
    assert sync_vault(vault) is True  # removal counts as a change


def test_external_edit_is_indexed_and_committed_in_one_cycle(temp_dir):
    vault = Path(temp_dir)
    run_git(["init", "-b", "main"], cwd=vault)
    run_git(["config", "user.name", "Test"], cwd=vault)
    run_git(["config", "user.email", "test@example.com"], cwd=vault)
    (vault / "default").mkdir()
    (vault / "default" / "a.md").write_text(
        "---\ntype: task\nid: a\nproject_id: default\ntitle: A\nstatus: todo\nposition: 1000.0\n---\n",
        encoding="utf-8",
    )

    VaultSyncScheduler(vault).run_once()

    # The sync also writes the new project's manifest, so that shows up as another changed file
    assert get_git_history(vault)[0]["message"].startswith("jotter: 1 task created")


def test_commit_vault_creates_auto_commit_in_git_vault(temp_dir):
    vault = Path(temp_dir)
    run_git(["init", "-b", "main"], cwd=vault)
    run_git(["config", "user.name", "Test"], cwd=vault)
    run_git(["config", "user.email", "test@example.com"], cwd=vault)
    (vault / "default").mkdir()
    (vault / "default" / "a.md").write_text("---\ntitle: a\n---\n", encoding="utf-8")

    assert commit_vault(vault) is True
    assert get_git_history(vault)[0]["message"] == "jotter: 1 task created"
    assert commit_vault(vault) is False  # nothing new


def test_commit_vault_skips_non_git_vault(temp_dir):
    assert commit_vault(Path(temp_dir)) is False
    assert not (Path(temp_dir) / ".git").exists()


class RecordingScheduler:
    def __init__(self):
        self.calls = 0

    def mark_dirty(self):
        self.calls += 1


def test_mutating_api_calls_mark_vault_dirty(temp_dir):
    config = UserConfig(data_dir=temp_dir, port=8000, vaults_config_path=str(Path(temp_dir) / "vaults.json"))
    app = create_app(config, enable_background_sync=False)
    with TestClient(app) as client:
        rec = RecordingScheduler()
        app.state.sync_scheduler = rec

        client.get("/api/projects")
        assert rec.calls == 0  # reads never mark dirty

        assert client.post("/api/projects", json={"title": "P"}).status_code in (200, 201)
        assert rec.calls == 1

        assert client.post("/api/projects", json={}).status_code >= 400
        assert rec.calls == 1  # failed requests don't count

        client.post("/api/system/git/init")
        assert rec.calls == 1  # the Git-init endpoint itself doesn't re-dirty


def test_commit_vault_respects_auto_commit_setting(temp_dir):
    from jotter.features.settings.schemas import SettingsUpdate
    from jotter.features.settings.service import SettingsApplicationService

    vault = Path(temp_dir)
    run_git(["init", "-b", "main"], cwd=vault)
    run_git(["config", "user.name", "Test"], cwd=vault)
    run_git(["config", "user.email", "test@example.com"], cwd=vault)
    (vault / "default").mkdir()
    (vault / "default" / "a.md").write_text("---\ntitle: a\n---\n", encoding="utf-8")
    SettingsApplicationService(str(vault)).update_settings(SettingsUpdate(autoCommit=False))

    assert commit_vault(vault) is False
    SettingsApplicationService(str(vault)).update_settings(SettingsUpdate(autoCommit=True))
    assert commit_vault(vault) is True


def test_slow_step_is_logged_as_warning(tmp_path, caplog, monkeypatch):
    import jotter.features.sync.scheduler as module

    monkeypatch.setattr(module, "SLOW_STEP_SECONDS", -1.0)
    h = Harness(tmp_path)
    h.scheduler.mark_dirty()
    with caplog.at_level("WARNING", logger="jotter.features.sync.scheduler"):
        h.scheduler.run_once()
    messages = [r.message for r in caplog.records if r.levelname == "WARNING"]
    assert any(m.startswith("Periodic sync of") for m in messages)
    assert any(m.startswith("Auto-commit of") for m in messages)
