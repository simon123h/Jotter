from pathlib import Path

from fastapi.testclient import TestClient

from jotter.app import create_app
from jotter.config import UserConfig
from jotter.features.sync.auto_commit import AutoCommitScheduler, commit_vault
from jotter.features.sync.git_adapter import get_git_history, run_git


class FakeTimer:
    def __init__(self, delay, fn):
        self.delay = delay
        self.fn = fn
        self.cancelled = False

    def cancel(self):
        self.cancelled = True


class Harness:
    """Scheduler with a controllable clock and manually fired timers."""

    def __init__(self, tmp_path, results=None):
        self.now = 1000.0
        self.timers: list[FakeTimer] = []
        self.commits = 0
        self.results = results if results is not None else []

        def commit_fn(_dir):
            self.commits += 1
            return self.results.pop(0) if self.results else True

        def timer_factory(delay, fn):
            t = FakeTimer(delay, fn)
            self.timers.append(t)
            return t

        self.scheduler = AutoCommitScheduler(
            tmp_path,
            commit_fn=commit_fn,
            cooldown_seconds=60,
            debounce_seconds=3,
            clock=lambda: self.now,
            timer_factory=timer_factory,
        )

    def fire(self):
        timer = self.timers[-1]
        if not timer.cancelled:
            timer.fn()


def test_first_change_commits_after_debounce(tmp_path):
    h = Harness(tmp_path)
    h.scheduler.mark_dirty()
    assert [t.delay for t in h.timers] == [3]
    h.fire()
    assert h.commits == 1


def test_burst_of_changes_is_coalesced(tmp_path):
    h = Harness(tmp_path)
    for _ in range(5):
        h.scheduler.mark_dirty()
    assert len(h.timers) == 1
    h.fire()
    assert h.commits == 1


def test_change_during_cooldown_commits_at_its_end(tmp_path):
    h = Harness(tmp_path)
    h.scheduler.mark_dirty()
    h.fire()
    h.now += 10
    h.scheduler.mark_dirty()
    h.scheduler.mark_dirty()
    assert len(h.timers) == 2
    assert h.timers[-1].delay == 50  # 60s cooldown minus the 10s that passed
    assert h.commits == 1
    h.now += 50
    h.fire()
    assert h.commits == 2


def test_change_after_cooldown_uses_debounce_only(tmp_path):
    h = Harness(tmp_path)
    h.scheduler.mark_dirty()
    h.fire()
    h.now += 120
    h.scheduler.mark_dirty()
    assert h.timers[-1].delay == 3


def test_no_changes_means_no_commit(tmp_path):
    h = Harness(tmp_path)
    h.scheduler.flush()
    assert h.commits == 0


def test_empty_commit_does_not_consume_cooldown(tmp_path):
    h = Harness(tmp_path, results=[False])
    h.scheduler.mark_dirty()
    h.fire()
    h.scheduler.mark_dirty()
    assert h.timers[-1].delay == 3


def test_failing_commit_does_not_break_scheduler(tmp_path):
    h = Harness(tmp_path)

    def boom(_dir):
        raise RuntimeError("git exploded")

    h.scheduler._commit_fn = boom
    h.scheduler.mark_dirty()
    h.fire()  # must not raise
    h.scheduler._commit_fn = lambda _dir: True
    h.scheduler.mark_dirty()
    assert len(h.timers) == 2


def test_flush_commits_pending_changes_ignoring_cooldown(tmp_path):
    h = Harness(tmp_path)
    h.scheduler.mark_dirty()
    h.fire()
    h.now += 5
    h.scheduler.mark_dirty()
    h.scheduler.flush()
    assert h.commits == 2
    assert h.timers[-1].cancelled


def test_retarget_flushes_old_vault_and_resets_cooldown(tmp_path):
    h = Harness(tmp_path)
    h.scheduler.mark_dirty()
    h.fire()
    h.now += 5
    h.scheduler.mark_dirty()
    h.scheduler.retarget(tmp_path / "other")
    assert h.commits == 2
    assert h.scheduler.data_dir == tmp_path / "other"
    h.scheduler.mark_dirty()
    assert h.timers[-1].delay == 3


def test_stopped_scheduler_ignores_changes(tmp_path):
    h = Harness(tmp_path)
    h.scheduler.stop()
    h.scheduler.mark_dirty()
    assert h.timers == []


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
    app = create_app(config, enable_watcher=False)
    with TestClient(app) as client:
        rec = RecordingScheduler()
        app.state.auto_commit = rec

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
