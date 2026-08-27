"""Application service orchestrating Project use cases."""

from jotter.domain.exceptions import EntityNotFoundError, ValidationError
from jotter.domain.project import Project
from jotter.infrastructure.repositories.bucket_repository import BucketRepository
from jotter.infrastructure.repositories.project_repository import ProjectRepository
from jotter.models.project import ProjectCreate, ProjectResponse, ProjectUpdate
from jotter.utils.slug import slugify


class ProjectApplicationService:
    def __init__(self, data_dir: str):
        self.data_dir = data_dir
        self.project_repo = ProjectRepository(data_dir)
        self.bucket_repo = BucketRepository(data_dir)

    def get_all_projects(self) -> list[ProjectResponse]:
        projects = self.project_repo.get_all()
        if not projects:
            # Seed default project if empty
            default_p = Project.create(name="Default", project_id="default")
            self.project_repo.save(default_p)
            self.bucket_repo.get_all("default")
            projects = [default_p]

        res: list[ProjectResponse] = []
        for p in projects:
            res.append(
                ProjectResponse(
                    id=p.id,
                    title=p.name,
                    git_remote=p.git_remote,
                    created_at=p.created_at,
                )
            )
        return res

    def get_project(self, project_id: str) -> ProjectResponse:
        p = self.project_repo.get(project_id)
        return ProjectResponse(
            id=p.id,
            title=p.name,
            git_remote=p.git_remote,
            created_at=p.created_at,
        )

    def create_project(self, req: ProjectCreate) -> ProjectResponse:
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
        )

        self.project_repo.save(project)
        # Seed default buckets for new project
        self.bucket_repo.get_all(project.id)

        return ProjectResponse(
            id=project.id,
            title=project.name,
            git_remote=project.git_remote,
            created_at=project.created_at,
        )

    def update_project(self, project_id: str, req: ProjectUpdate) -> ProjectResponse:
        project = self.project_repo.get(project_id)

        title = req.title.strip() if req.title is not None else None
        project.update_details(
            name=title,
            git_remote=req.git_remote,
        )

        self.project_repo.save(project)

        return ProjectResponse(
            id=project.id,
            title=project.name,
            git_remote=project.git_remote,
            created_at=project.created_at,
        )

    def delete_project(self, project_id: str) -> None:
        if not self.project_repo.exists(project_id):
            raise EntityNotFoundError(f"Project '{project_id}' not found")
        self.project_repo.delete(project_id)
