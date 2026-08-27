"""Application service for disk <-> SQLite synchronization and reconciliation."""

from pathlib import Path

from jotter.domain.bucket import Bucket
from jotter.domain.project import Project
from jotter.infrastructure.repositories.bucket_repository import BucketRepository
from jotter.infrastructure.repositories.disk_task_repository import DiskTaskRepository
from jotter.infrastructure.repositories.project_repository import ProjectRepository
from jotter.infrastructure.repositories.sqlite_task_repository import SqliteTaskRepository
from jotter.services.git_service import git_sync


class SyncApplicationService:
    def __init__(self, data_dir: str):
        self.data_dir = data_dir
        self.disk_task_repo = DiskTaskRepository(data_dir)
        self.sqlite_task_repo = SqliteTaskRepository()
        self.bucket_repo = BucketRepository(data_dir)
        self.project_repo = ProjectRepository(data_dir)

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
                    print(f"[Sync] Warning: Failed to sync task file {file_path}: {e}")

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
                    print(f"[Sync] Git sync warning for project '{p.id}': {e}")

        return self.sync_db_only()
