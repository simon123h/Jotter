"""Pydantic schemas and DTOs for Buckets (Columns)."""

from pydantic import BaseModel, ConfigDict


class BucketCreate(BaseModel):
    model_config = ConfigDict(extra="ignore")

    title: str
    subtitle: str | None = ""
    color: str | None = None
    layout: str | None = "list"
    max_tasks: int | None = None
    is_default: bool | None = False
    position: float | None = None
    name: str | None = None


class BucketUpdate(BaseModel):
    model_config = ConfigDict(extra="ignore")

    title: str | None = None
    subtitle: str | None = None
    position: float | None = None
    color: str | None = None
    layout: str | None = None
    max_tasks: int | None = None
    is_default: bool | None = None


class BucketResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    name: str
    title: str
    subtitle: str = ""
    position: float
    color: str | None = None
    layout: str = "list"
    max_tasks: int | None = None
    is_default: bool = False
