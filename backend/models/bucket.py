from typing import Optional
from pydantic import BaseModel, ConfigDict


class BucketCreate(BaseModel):
    title: str
    subtitle: Optional[str] = ""
    color: Optional[str] = None
    layout: Optional[str] = "list"
    max_tasks: Optional[int] = None
    is_default: Optional[bool] = False


class BucketUpdate(BaseModel):
    title: Optional[str] = None
    subtitle: Optional[str] = None
    position: Optional[float] = None
    color: Optional[str] = None
    layout: Optional[str] = None
    max_tasks: Optional[int] = None
    is_default: Optional[bool] = None


class BucketResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    name: str
    title: str
    subtitle: str = ""
    position: float
    color: Optional[str] = None
    layout: str = "list"
    max_tasks: Optional[int] = None
    is_default: bool = False
