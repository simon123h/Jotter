from pydantic import BaseModel, ConfigDict


class ProjectCreate(BaseModel):
    title: str
    done_clean_period: int | None = None
    git_remote: str | None = None


class ProjectUpdate(BaseModel):
    title: str | None = None
    done_clean_period: int | None = None
    git_remote: str | None = None


class ProjectResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    title: str
    created_at: str
    done_clean_period: int | None = None
    git_remote: str | None = None
