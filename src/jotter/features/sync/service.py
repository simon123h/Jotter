import json
import logging
import sqlite3
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Self

from jotter.features.buckets.domain import Bucket
from jotter.features.buckets.repo import BucketRepository
from jotter.features.projects.repo import ProjectRepository
from jotter.features.sync.git_adapter import commit_changes, enable_git_versioning
from jotter.features.tasks.disk_repo import DiskTaskRepository
from jotter.features.tasks.sqlite_repo import SqliteTaskRepository
from jotter.shared.db import SCHEMA_VERSION, recreate_schema

logger = logging.getLogger(__name__)

# A file modified this recently could change again within the same mtime tick, so its stat is not trusted
RACY_MTIME_NS = 2_000_000_000


def _app_version() -> str:
    try:
        from jotter._version import __version__

        return __version__
    except ImportError:
        return "unknown"


def _index_version() -> str:
    """The version an index is built for: the app version plus the table layout, so a schema change always counts."""
    return f"{_app_version()}+s{SCHEMA_VERSION}"


def _file_stat(path: Path) -> tuple[int, int] | None:
    """Returns (mtime_ns, size) for skipping an unchanged file on a later sync, or None if it cannot be trusted."""
    try:
        st = path.stat()
    except OSError:
        return None
    if time.time_ns() - st.st_mtime_ns < RACY_MTIME_NS:
        return None
    return st.st_mtime_ns, st.st_size


def _is_expired(
    bucket: str, updated_at: str | None, created_at: str | None, clean_period: int | None, now: datetime
) -> bool:
    """True if a done task is older than the retention period."""
    if not clean_period or clean_period <= 0 or bucket != "done":
        return False
    date_str = updated_at or created_at
    if not date_str:
        return False
    try:
        dt = datetime.fromisoformat(date_str.replace("Z", "+00:00"))
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return (now - dt).total_seconds() / 86400.0 >= clean_period
    except Exception:
        return False


class SyncApplicationService:
    def __init__(
        self,
        data_dir: Path | str,
        disk_task_repo: DiskTaskRepository,
        sqlite_task_repo: SqliteTaskRepository,
        bucket_repo: BucketRepository,
        project_repo: ProjectRepository,
    ):
        self.data_dir = str(data_dir)
        self.disk_task_repo = disk_task_repo
        self.sqlite_task_repo = sqlite_task_repo
        self.bucket_repo = bucket_repo
        self.project_repo = project_repo
        # Task files re-read or removed from the index by the last sync_db_only(); zero means nothing changed
        self.last_changes = 0
        # Task files the last sync_db_only() could not read because of an I/O error (e.g. a Windows file lock)
        self.last_io_errors = 0

    @classmethod
    def from_data_dir(cls, data_dir: Path | str, conn: sqlite3.Connection) -> Self:
        return cls(
            data_dir=data_dir,
            disk_task_repo=DiskTaskRepository(data_dir),
            sqlite_task_repo=SqliteTaskRepository(conn),
            bucket_repo=BucketRepository(data_dir, conn),
            project_repo=ProjectRepository(data_dir, conn),
        )

    def sync_db_only(self, force: bool = False) -> int:
        """Reconciles SQLite database index against disk files and prunes expired done tasks.

        Task files whose size and modification time match what the index recorded are not read again,
        unless `force` is set (a full rebuild).
        """
        self.last_changes = 0
        self.last_io_errors = 0
        from jotter.features.projects.manifest import read_project_manifest

        # 1. Discover all projects on disk
        disk_projects = self.project_repo.discover_disk_projects()
        existing_db_projects = self.project_repo.get_all()

        if not disk_projects and not existing_db_projects:
            disk_projects = ["default"]

        # Reconcile disk projects into SQLite
        synced_project_ids = set()
        for proj_id in disk_projects:
            proj_dir = Path(self.data_dir) / proj_id
            proj_dir.mkdir(parents=True, exist_ok=True)

            project, buckets = read_project_manifest(proj_dir, fallback_id=proj_id)

            self.project_repo.save(project)
            for b in buckets:
                self.bucket_repo.save(proj_id, b)
            synced_project_ids.add(proj_id)

        # Remove projects from SQLite if their folders are no longer present on disk
        for ep in existing_db_projects:
            if ep.id not in synced_project_ids:
                # Guard against race conditions: verify folder actually does not exist on disk
                proj_folder = Path(self.data_dir) / ep.id
                if not proj_folder.is_dir():
                    self.project_repo.delete(ep.id)

        # 2. Check global doneCleanPeriod
        settings_file = Path(self.data_dir) / "settings.json"
        global_clean_period = None
        if settings_file.is_file():
            try:
                with open(settings_file, encoding="utf-8") as f:
                    s_data = json.load(f)
                    global_clean_period = s_data.get("doneCleanPeriod")
            except Exception:
                pass

        now = datetime.now(timezone.utc)

        # 3. Sync all task files for all projects
        total_synced = 0
        projects = self.project_repo.get_all()

        for project in projects:
            p_id = project.id
            clean_period = project.done_clean_period if project.done_clean_period is not None else global_clean_period
            task_files = self.disk_task_repo.get_all_task_files(p_id)
            disk_task_ids: set[str] = set()

            known_buckets = {b.name: b for b in self.bucket_repo.get_all(p_id)}

            indexed = {} if force else self.sqlite_task_repo.get_index_state(p_id)

            for file_path in task_files:
                # Always track the disk task ID from the filename so transient read errors
                # (e.g. temporary Windows file locks) do not cause SQLite to purge the task
                disk_task_ids.add(file_path.stem)
                try:
                    # Stat before reading: if the file changes in between, the stale stat just forces a re-read
                    file_stat = _file_stat(file_path)

                    known = indexed.get(file_path.stem)
                    if known is not None and file_stat is not None and known.file_stat == file_stat:
                        # Unchanged since it was indexed: no need to open and parse it (retention still applies)
                        if _is_expired(known.bucket, known.updated_at, known.created_at, clean_period, now):
                            self.disk_task_repo.delete(p_id, file_path.stem)
                            self.sqlite_task_repo.delete_task(file_path.stem)
                            self.last_changes += 1
                        else:
                            total_synced += 1
                        continue

                    task = self.disk_task_repo.read_task_file(file_path, default_project_id=p_id)
                    self.last_changes += 1

                    # Check if done task should be pruned based on retention period
                    if _is_expired(task.bucket, task.updated_at, task.created_at, clean_period, now):
                        self.disk_task_repo.delete(p_id, str(task.id))
                        self.sqlite_task_repo.delete_task(str(task.id))
                        continue

                    disk_task_ids.add(str(task.id))

                    # Auto-register unknown buckets referenced in markdown files
                    if task.bucket not in known_buckets:
                        new_b = Bucket.create(title=task.bucket.capitalize(), name=task.bucket)
                        self.bucket_repo.save(p_id, new_b)
                        known_buckets[task.bucket] = new_b

                    # Index task in SQLite
                    self.sqlite_task_repo.upsert_task(task, file_stat)
                    total_synced += 1
                except Exception as e:
                    if isinstance(e, OSError):
                        self.last_io_errors += 1
                    logger.warning("Failed to sync task file %s: %s", file_path, e)

            # 4. Clean up deleted markdown tasks from SQLite
            for indexed_id in self.sqlite_task_repo.get_task_ids(p_id) - disk_task_ids:
                # Guard against race conditions: verify the file actually doesn't exist on disk
                # (a task could have been created concurrently while the disk snapshot was being processed)
                if not self.disk_task_repo.exists(p_id, indexed_id):
                    self.sqlite_task_repo.delete_task(indexed_id)
                    self.last_changes += 1

        return total_synced

    def sync_on_startup(self) -> int:
        """Reconciles the index when a vault is opened, rebuilding it completely after a Jotter upgrade.

        The index is a disposable cache whose contents and table layout depend on the Jotter version, so a new
        version drops the schema, recreates it and re-reads every task file instead of migrating anything.
        """
        conn = self.sqlite_task_repo.conn
        # fetchall() so the statement is finished: a cursor left half-read would make the DROP TABLE below fail
        rows = conn.execute("SELECT value FROM meta WHERE key = 'index_version'").fetchall()
        version = _index_version()
        rebuild = not rows or rows[0]["value"] != version
        if rebuild:
            recreate_schema(conn)
        synced = self.sync_db_only(force=rebuild)
        # A file that could not be read has no row after the rebuild (the old ones were dropped). Do not record the
        # version, so the rebuild is retried at the next start, and the periodic sync indexes the file as soon as it
        # can be read again. Unreadable content, as opposed to an I/O error, would fail again every time, so it counts.
        if rebuild and self.last_io_errors == 0:
            conn.execute("INSERT OR REPLACE INTO meta (key, value) VALUES ('index_version', ?)", (version,))
        return synced

    def commit_changes(self) -> bool:
        """Commits pending changes in the vault (if it is a Git repository) and in project folders with their own repo.

        Local only: never initializes a repository and never talks to a remote. Returns True if any commit was created.
        """
        targets = [self.data_dir, *(str(Path(self.data_dir) / p.id) for p in self.project_repo.get_all())]
        committed = False
        for target in targets:
            try:
                committed = commit_changes(target) or committed
            except Exception as e:
                logger.warning("Local Git commit error for '%s': %s", target, e)
        return committed

    def enable_git_versioning(self) -> bool:
        """Turns the vault into a Git repository and records the initial commit. Returns True if newly created."""
        created = enable_git_versioning(self.data_dir)
        if created:
            self.commit_changes()
        return created
