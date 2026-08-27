from typing import Optional
from pydantic import BaseModel, ConfigDict


class ProjectCreate(BaseModel):
    title: str
    done_clean_period: Optional[int] = None
    git_remote: Optional[str] = None


class ProjectUpdate(BaseModel):
    title: Optional[str] = None
    done_clean_period: Optional[int] = None
    git_remote: Optional[str] = None


class ProjectResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    title: str
    created_at: str
    done_clean_period: Optional[int] = None
    git_remote: Optional[str] = None
