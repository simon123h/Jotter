"""Pydantic schemas and DTOs for Projects."""

from pydantic import BaseModel, ConfigDict


class ProjectCreate(BaseModel):
    model_config = ConfigDict(extra="ignore")

    title: str
    id: str | None = None
    done_clean_period: int | None = None
    git_remote: str | None = None


class ProjectUpdate(BaseModel):
    model_config = ConfigDict(extra="ignore")

    title: str | None = None
    done_clean_period: int | None = None
    git_remote: str | None = None


class ProjectResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    title: str
    created_at: str
    done_clean_period: int | None = None
    git_remote: str | None = None
    task_count: int | None = None
