"""Pydantic schemas and DTOs for Projects."""

from pydantic import BaseModel, ConfigDict, Field


class ProjectCreate(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")

    title: str
    id: str | None = None
    done_clean_period: int | None = Field(default=None, alias="doneCleanPeriod")
    git_remote: str | None = Field(default=None, alias="gitRemote")


class ProjectUpdate(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")

    title: str | None = None
    done_clean_period: int | None = Field(default=None, alias="doneCleanPeriod")
    git_remote: str | None = Field(default=None, alias="gitRemote")


class ProjectResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    id: str
    title: str
    created_at: str
    done_clean_period: int | None = None
    git_remote: str | None = None
    task_count: int | None = None
