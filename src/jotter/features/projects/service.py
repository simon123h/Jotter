"""Application service orchestrating Project use cases."""

import sqlite3
from pathlib import Path
from typing import Any, Self

from jotter.features.buckets.repo import BucketRepository
from jotter.features.projects.domain import Project
from jotter.features.projects.repo import ProjectRepository
from jotter.features.projects.schemas import ProjectCreate, ProjectResponse, ProjectUpdate
from jotter.shared.exceptions import EntityNotFoundError, ValidationError
from jotter.shared.slug import slugify


class ProjectApplicationService:
    def __init__(self, project_repo: ProjectRepository, bucket_repo: BucketRepository):
        self.project_repo = project_repo
        self.bucket_repo = bucket_repo

    @classmethod
    def from_data_dir(cls, data_dir: Path | str, conn: sqlite3.Connection) -> Self:
        return cls(
            project_repo=ProjectRepository(data_dir, conn),
            bucket_repo=BucketRepository(data_dir, conn),
        )

    def get_all_projects(self) -> list[ProjectResponse]:
        projects = self.project_repo.get_all()
        if not projects:
            # Seed default project if empty
            default_p = Project.create(name="Default", project_id="default")
            self.project_repo.save(default_p)
            self.bucket_repo.get_all("default")
            projects = [default_p]

        return [self._to_response(p) for p in projects]

    def get_project(self, project_id: str) -> ProjectResponse:
        return self._to_response(self.project_repo.get(project_id))

    def create_project(
        self, req: ProjectCreate, default_buckets: list[dict[str, Any]] | None = None
    ) -> ProjectResponse:
        title = (getattr(req, "title", None) or getattr(req, "name", "")).strip()
        if not title:
            raise ValidationError("Project title cannot be empty")

        slug = getattr(req, "id", None)
        if not slug:
            slug = slugify(title)
        if not slug:
            slug = "project"

        if self.project_repo.exists(slug):
            raise ValidationError(f"Project with ID '{slug}' already exists")

        project = Project.create(
            name=title,
            project_id=slug,
            git_remote=req.git_remote,
            done_clean_period=req.done_clean_period,
        )

        self.project_repo.save(project)
        # Seed default buckets for new project
        self.bucket_repo.get_all(project.id)

        return self._to_response(project)

    def update_project(self, project_id: str, req: ProjectUpdate) -> ProjectResponse:
        project = self.project_repo.get(project_id)

        title = req.title.strip() if req.title is not None else None
        project.update_details(
            name=title,
            git_remote=req.git_remote,
            done_clean_period=req.done_clean_period,
        )

        self.project_repo.save(project)
        return self._to_response(project)

    def delete_project(self, project_id: str) -> None:
        if not self.project_repo.exists(project_id):
            raise EntityNotFoundError(f"Project '{project_id}' not found")
        self.project_repo.delete(project_id)

    def _to_response(self, p: Project) -> ProjectResponse:
        return ProjectResponse(
            id=p.id,
            title=p.name,
            git_remote=p.git_remote,
            done_clean_period=p.done_clean_period,
            created_at=p.created_at,
        )
