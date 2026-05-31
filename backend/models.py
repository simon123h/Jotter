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


class TaskCreate(TaskBase):
    pass


class TaskUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=200)
    bucket: Optional[str] = None
    tags: Optional[List[str]] = None
    body: Optional[str] = None
    position: Optional[float] = None


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
    created_at: str
    updated_at: str

    model_config = {"from_attributes": True}


class BucketBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=50)
    title: str = Field(..., min_length=1, max_length=100)


class BucketCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=100)


class BucketUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=100)
    position: Optional[float] = None


class BucketResponse(BucketBase):
    position: float

    model_config = {"from_attributes": True}
