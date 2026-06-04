from typing import List, Optional

from pydantic import BaseModel, Field


class ProjectCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=100)


class ProjectUpdate(BaseModel):
    title: str = Field(..., min_length=1, max_length=100)


class ProjectResponse(BaseModel):
    id: str
    title: str
    created_at: str

    model_config = {"from_attributes": True}


class TaskBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    bucket: str = Field(
        "todo",
        description="Column/status bucket e.g., backlog, todo, in-progress, done",
    )
    tags: List[str] = Field(default_factory=list)
    body: str = Field("", description="Markdown content of the task")
    due_date: Optional[str] = Field(None, description="Optional due date in YYYY-MM-DD format")
    priority: Optional[str] = Field(None, description="Optional priority level: low, medium, high, urgent")


class TaskCreate(TaskBase):
    pass


class TaskUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=200)
    bucket: Optional[str] = None
    tags: Optional[List[str]] = None
    body: Optional[str] = None
    position: Optional[float] = None
    due_date: Optional[str] = None
    priority: Optional[str] = None


class TaskMove(BaseModel):
    bucket: str
    position: float


class TaskResponse(BaseModel):
    id: int
    project_id: str
    title: str
    bucket: str
    position: float
    tags: List[str]
    body: str
    due_date: Optional[str] = None
    priority: Optional[str] = None
    created_at: str
    updated_at: str

    model_config = {"from_attributes": True}


class BucketBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=50)
    title: str = Field(..., min_length=1, max_length=100)
    subtitle: str = Field("", description="A short subtitle/description of the column")
    color: Optional[str] = Field(None, description="Optional color highlight/tint for the column")


class BucketCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=100)
    subtitle: Optional[str] = Field("", description="A short subtitle/description of the column")
    color: Optional[str] = Field(None, description="Optional color highlight/tint for the column")


class BucketUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=100)
    subtitle: Optional[str] = Field(None, description="A short subtitle/description of the column")
    position: Optional[float] = None
    color: Optional[str] = None


class BucketResponse(BucketBase):
    position: float

    model_config = {"from_attributes": True}
