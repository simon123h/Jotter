import json
import logging
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
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
        """Reconciles SQLite database index against disk files and prunes expired done tasks."""
        from jotter.features.projects.manifest import read_project_manifest

        # 0. Load legacy projects.json if present
        legacy_projects_file = Path(self.data_dir) / "projects.json"
        legacy_projects_map: dict[str, dict] = {}
        if legacy_projects_file.is_file():
            try:
                content = json.loads(legacy_projects_file.read_text(encoding="utf-8"))
                if isinstance(content, list):
                    for p in content:
                        if isinstance(p, dict) and p.get("id"):
                            legacy_projects_map[str(p["id"]).strip()] = p
                elif isinstance(content, dict):
                    for k, v in content.items():
                        if isinstance(v, dict):
                            p_id = str(v.get("id") or k).strip()
                            legacy_projects_map[p_id] = v
            except Exception as e:
                logger.warning("Failed to parse legacy projects.json: %s", e)

        # 1. Discover all projects on disk (and from legacy projects.json)
        disk_projects = self.project_repo.discover_disk_projects()
        if not disk_projects and not self.project_repo.get_all():
            disk_projects = ["default"]

        for proj_id in disk_projects:
            proj_dir = Path(self.data_dir) / proj_id
            proj_dir.mkdir(parents=True, exist_ok=True)
            legacy_data = legacy_projects_map.get(proj_id)

            existing_proj = None
            if self.project_repo.exists(proj_id):
                try:
                    existing_proj = self.project_repo.get(proj_id)
                except Exception:
                    pass

            project, buckets = read_project_manifest(proj_dir, fallback_id=proj_id, legacy_data=legacy_data)

            # Preserve existing SQLite git_remote if index.md or legacy data did not specify one
            if not project.git_remote and existing_proj and existing_proj.git_remote:
                project.git_remote = existing_proj.git_remote

            self.project_repo.save(project)
            for b in buckets:
                self.bucket_repo.save(proj_id, b)

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
