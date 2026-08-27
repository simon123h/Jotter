from typing import List, Optional
from pydantic import BaseModel, ConfigDict


class TaskCreate(BaseModel):
    title: str
    bucket: str
    tags: List[str] = []
    body: str = ""
    due_date: Optional[str] = None
    planned_date: Optional[str] = None
    priority: Optional[str] = None
    color: Optional[str] = None
    postponed_until: Optional[str] = None


class TaskUpdate(BaseModel):
    project_id: Optional[str] = None
    title: Optional[str] = None
    bucket: Optional[str] = None
    position: Optional[float] = None
    tags: Optional[List[str]] = None
    attachments: Optional[List[str]] = None
    body: Optional[str] = None
    due_date: Optional[str] = None
    planned_date: Optional[str] = None
    priority: Optional[str] = None
    color: Optional[str] = None
    postponed_until: Optional[str] = None


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
    tags: List[str] = []
    attachments: List[str] = []
    body: str = ""
    due_date: Optional[str] = None
    planned_date: Optional[str] = None
    priority: Optional[str] = None
    color: Optional[str] = None
    postponed_until: Optional[str] = None
    created_at: str
    updated_at: str


class TaskFrontmatter(BaseModel):
    id: str
    project_id: str
    title: str
    bucket: str
    position: float
    tags: List[str] = []
    attachments: Optional[List[str]] = None
    due_date: Optional[str] = None
    planned_date: Optional[str] = None
    priority: Optional[str] = None
    color: Optional[str] = None
    postponed_until: Optional[str] = None
    created_at: str
    updated_at: str
