import json
import logging
import sqlite3
from collections.abc import Iterable
from datetime import datetime, timezone
from pathlib import Path
from typing import Self

from jotter.features.buckets.domain import Bucket
from jotter.features.buckets.repo import BucketRepository
from jotter.features.projects.repo import ProjectRepository
from jotter.features.sync.git_adapter import commit_changes, enable_git_versioning
from jotter.features.tasks.disk_repo import DiskTaskRepository
from jotter.features.tasks.sqlite_repo import SqliteTaskRepository

logger = logging.getLogger(__name__)


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

    @classmethod
    def from_data_dir(cls, data_dir: Path | str, conn: sqlite3.Connection) -> Self:
        return cls(
            data_dir=data_dir,
            disk_task_repo=DiskTaskRepository(data_dir),
            sqlite_task_repo=SqliteTaskRepository(conn),
            bucket_repo=BucketRepository(data_dir, conn),
            project_repo=ProjectRepository(data_dir, conn),
        )

    def sync_db_only(self) -> int:
        """Reconciles SQLite database index against disk files and prunes expired done tasks."""
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

            for file_path in task_files:
                # Always track the disk task ID from the filename so transient read errors
                # (e.g. temporary Windows file locks) do not cause SQLite to purge the task
                disk_task_ids.add(file_path.stem)
                try:
                    task = self.disk_task_repo.read_task_file(file_path, default_project_id=p_id)

                    # Check if done task should be pruned based on retention period
                    if clean_period and clean_period > 0 and task.bucket == "done":
                        date_str = task.updated_at or task.created_at
                        if date_str:
                            try:
                                dt = datetime.fromisoformat(date_str.replace("Z", "+00:00"))
                                if dt.tzinfo is None:
                                    dt = dt.replace(tzinfo=timezone.utc)
                                diff_days = (now - dt).total_seconds() / 86400.0
                                if diff_days >= clean_period:
                                    self.disk_task_repo.delete(p_id, str(task.id))
                                    self.sqlite_task_repo.delete_task(str(task.id))
                                    continue
                            except Exception:
                                pass

                    disk_task_ids.add(str(task.id))

                    # Auto-register unknown buckets referenced in markdown files
                    if task.bucket not in known_buckets:
                        new_b = Bucket.create(title=task.bucket.capitalize(), name=task.bucket)
                        self.bucket_repo.save(p_id, new_b)
                        known_buckets[task.bucket] = new_b

                    # Index task in SQLite
                    self.sqlite_task_repo.upsert_task(task)
                    total_synced += 1
                except Exception as e:
                    logger.warning("Failed to sync task file %s: %s", file_path, e)

            # 4. Clean up deleted markdown tasks from SQLite
            for indexed_id in self.sqlite_task_repo.get_task_ids(p_id) - disk_task_ids:
                # Guard against race conditions: verify the file actually doesn't exist on disk
                # (a task could have been created concurrently while the disk snapshot was being processed)
                if not self.disk_task_repo.exists(p_id, indexed_id):
                    self.sqlite_task_repo.delete_task(indexed_id)

        return total_synced

    def sync_task_files(self, changes: Iterable[tuple[str, str]]) -> bool:
        """Reconciles only the given (project_id, task_id) task files with SQLite.

        Returns False without doing anything if a change belongs to a project SQLite does not know yet,
        in which case the caller must run a full `sync_db_only()`.
        """
        changes = set(changes)
        if not all(self.project_repo.exists(project_id) for project_id, _ in changes):
            return False

        known_buckets: dict[str, set[str]] = {}
        for project_id, task_id in sorted(changes):
            path = self.disk_task_repo.get_task_file_path(project_id, task_id)
            if not path.is_file():
                self.sqlite_task_repo.delete_task(task_id)
                continue
            try:
                task = self.disk_task_repo.read_task_file(path, default_project_id=project_id)
                if project_id not in known_buckets:
                    known_buckets[project_id] = {b.name for b in self.bucket_repo.get_all(project_id)}
                if task.bucket not in known_buckets[project_id]:
                    self.bucket_repo.save(project_id, Bucket.create(title=task.bucket.capitalize(), name=task.bucket))
                    known_buckets[project_id].add(task.bucket)
                self.sqlite_task_repo.upsert_task(task)
            except Exception as e:
                # Keep the indexed task on transient read errors (e.g. a Windows file lock)
                logger.warning("Failed to sync task file %s: %s", path, e)
        return True

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
