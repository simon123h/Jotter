"""Pydantic schemas and DTOs for Tasks."""

from pydantic import BaseModel, ConfigDict, Field, field_validator


class TaskCreate(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")

    title: str
    bucket: str = "todo"
    tags: list[str] = []
    body: str = ""
    due_date: str | None = Field(default=None, alias="dueDate")
    planned_date: str | None = Field(default=None, alias="plannedDate")
    priority: str | None = None
    color: str | None = None
    postponed_until: str | None = Field(default=None, alias="postponedUntil")
    position: float | None = None

    @field_validator("tags", mode="before")
    @classmethod
    def validate_tags(cls, v):
        if v is None:
            return []
        return v


class TaskUpdate(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")

    project_id: str | None = Field(default=None, alias="projectId")
    title: str | None = None
    bucket: str | None = None
    position: float | None = None
    tags: list[str] | None = None
    attachments: list[str] | None = None
    body: str | None = None
    due_date: str | None = Field(default=None, alias="dueDate")
    planned_date: str | None = Field(default=None, alias="plannedDate")
    priority: str | None = None
    color: str | None = None
    postponed_until: str | None = Field(default=None, alias="postponedUntil")


class TaskMove(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")

    bucket: str
    position: float


class TaskResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    id: str
    project_id: str
    title: str
    bucket: str
    position: float
    tags: list[str] = []
    attachments: list[str] = []
    body: str = ""
    due_date: str | None = None
    planned_date: str | None = None
    priority: str | None = None
    color: str | None = None
    postponed_until: str | None = None
    created_at: str
    updated_at: str


class TaskFrontmatter(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: str
    project_id: str
    title: str
    bucket: str
    position: float
    tags: list[str] = []
    attachments: list[str] = []
    due_date: str | None = None
    planned_date: str | None = None
    priority: str | None = None
    color: str | None = None
    postponed_until: str | None = None
    created_at: str
    updated_at: str
