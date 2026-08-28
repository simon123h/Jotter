"""Application service for disk <-> SQLite synchronization and Git reconciliation."""

import logging
from pathlib import Path
import sqlite3
from typing import Self

from jotter.features.buckets.domain import Bucket
from jotter.features.buckets.repo import BucketRepository
from jotter.features.projects.domain import Project
from jotter.features.projects.repo import ProjectRepository
from jotter.features.sync.git_adapter import git_sync
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
        """Reconciles SQLite database index against disk files."""
        # 1. Discover all projects on disk
        disk_projects = self.project_repo.discover_disk_projects()
        if not disk_projects and not self.project_repo.get_all():
            disk_projects = ["default"]

        for proj_id in disk_projects:
            if not self.project_repo.exists(proj_id):
                self.project_repo.save(Project.create(name=proj_id.capitalize(), project_id=proj_id))
            self.bucket_repo.get_all(proj_id)

        # 2. Sync all task files for all projects
        total_synced = 0
        projects = self.project_repo.get_all()

        for project in projects:
            p_id = project.id
            task_files = self.disk_task_repo.get_all_task_files(p_id)
            disk_task_ids: set[str] = set()

            known_buckets = {b.name: b for b in self.bucket_repo.get_all(p_id)}

            for file_path in task_files:
                try:
                    task = self.disk_task_repo.read_task_file(file_path, default_project_id=p_id)
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

            # 3. Clean up deleted markdown tasks from SQLite
            sqlite_tasks = self.sqlite_task_repo.find_tasks(project_id=p_id)
            for st in sqlite_tasks:
                if str(st.id) not in disk_task_ids:
                    self.sqlite_task_repo.delete_task(str(st.id))

        return total_synced

    def full_sync(self) -> int:
        """Runs Git sync for all projects configured with remotes, then syncs SQLite."""
        projects = self.project_repo.get_all()
        for p in projects:
            if p.git_remote:
                proj_dir = str(Path(self.data_dir) / p.id)
                try:
                    git_sync(proj_dir, p.git_remote)
                except Exception as e:
                    logger.warning("Git sync error for project '%s': %s", p.id, e)

        return self.sync_db_only()
