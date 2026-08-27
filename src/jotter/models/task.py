from pydantic import BaseModel, ConfigDict, field_validator


class TaskCreate(BaseModel):
    title: str
    bucket: str
    tags: list[str] = []
    body: str = ""
    due_date: str | None = None
    planned_date: str | None = None
    priority: str | None = None
    color: str | None = None
    postponed_until: str | None = None

    @field_validator("tags", mode="before")
    @classmethod
    def validate_tags(cls, v):
        if v is None:
            return []
        return v


class TaskUpdate(BaseModel):
    project_id: str | None = None
    title: str | None = None
    bucket: str | None = None
    position: float | None = None
    tags: list[str] | None = None
    attachments: list[str] | None = None
    body: str | None = None
    due_date: str | None = None
    planned_date: str | None = None
    priority: str | None = None
    color: str | None = None
    postponed_until: str | None = None


class TaskMove(BaseModel):
    bucket: str
    position: float


class TaskResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

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

    @field_validator("tags", "attachments", mode="before")
    @classmethod
    def validate_list_fields(cls, v):
        if v is None:
            return []
        if isinstance(v, list):
            return [str(item) for item in v if item is not None]
        return []


class TaskFrontmatter(BaseModel):
    id: str
    project_id: str
    title: str
    bucket: str
    position: float = 1000.0
    tags: list[str] = []
    attachments: list[str] = []
    due_date: str | None = None
    planned_date: str | None = None
    priority: str | None = None
    color: str | None = None
    postponed_until: str | None = None
    created_at: str
    updated_at: str

    @field_validator("tags", "attachments", mode="before")
    @classmethod
    def validate_fm_lists(cls, v):
        if v is None:
            return []
        if isinstance(v, list):
            return [str(item) for item in v if item is not None]
        return []
