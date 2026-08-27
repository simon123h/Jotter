"""Project service facade delegating to ProjectApplicationService and ProjectRepository."""

from typing import Any

from jotter.application.services.project_service import ProjectApplicationService
from jotter.domain.exceptions import EntityNotFoundError, ValidationError
from jotter.domain.project import Project
from jotter.infrastructure.repositories.project_repository import ProjectRepository
from jotter.models.project import ProjectCreate, ProjectResponse, ProjectUpdate


def get_all_projects(data_dir: str) -> list[ProjectResponse]:
    return ProjectApplicationService(data_dir).get_all_projects()


def get_project(data_dir: str, project_id: str) -> ProjectResponse | None:
    try:
        return ProjectApplicationService(data_dir).get_project(project_id)
    except Exception:
        return None


def create_project(data_dir: str, req: ProjectCreate, default_buckets: list[dict[str, Any]] | None = None) -> ProjectResponse:
    try:
        return ProjectApplicationService(data_dir).create_project(req)
    except ValidationError as e:
        raise ValueError(str(e))


def update_project(data_dir: str, project_id: str, req: ProjectUpdate) -> ProjectResponse:
    try:
        return ProjectApplicationService(data_dir).update_project(project_id, req)
    except EntityNotFoundError as e:
        raise KeyError(str(e))
    except ValidationError as e:
        raise ValueError(str(e))


def delete_project(data_dir: str, project_id: str) -> None:
    try:
        ProjectApplicationService(data_dir).delete_project(project_id)
    except EntityNotFoundError as e:
        raise KeyError(str(e))


def project_exists(project_id: str) -> bool:
    return ProjectRepository("").exists(project_id)


def save_project(data_dir: str, project_id: str, name: str) -> None:
    ProjectRepository(data_dir).save(Project.create(name=name, project_id=project_id))
