from pydantic import BaseModel, ConfigDict


class BucketCreate(BaseModel):
    title: str
    subtitle: str | None = ""
    color: str | None = None
    layout: str | None = "list"
    max_tasks: int | None = None
    is_default: bool | None = False


class BucketUpdate(BaseModel):
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
