"""Pydantic schemas for Timeblock feature."""

from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class TimeblockBase(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")

    title: str = Field(..., min_length=1, max_length=200)
    date: str = Field(..., pattern=r"^\d{4}-\d{2}-\d{2}$")
    start_time: str = Field(..., pattern=r"^\d{2}:\d{2}$", alias="startTime")
    end_time: str = Field(..., pattern=r"^\d{2}:\d{2}$", alias="endTime")
    color: str | None = None
    task_ids: list[str] = Field(default_factory=list, alias="taskIds")
    recurrence: str | None = Field(default=None, pattern=r"^(none|daily|weekdays|weekly|bi-weekly)?$")


class TimeblockCreate(TimeblockBase):
    pass


class TimeblockUpdate(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")

    title: str | None = Field(default=None, min_length=1, max_length=200)
    date: str | None = Field(default=None, pattern=r"^\d{4}-\d{2}-\d{2}$")
    start_time: str | None = Field(default=None, pattern=r"^\d{2}:\d{2}$", alias="startTime")
    end_time: str | None = Field(default=None, pattern=r"^\d{2}:\d{2}$", alias="endTime")
    color: str | None = None
    task_ids: list[str] | None = Field(default=None, alias="taskIds")
    recurrence: str | None = Field(default=None, pattern=r"^(none|daily|weekdays|weekly|bi-weekly)?$")


class TimeblockResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    id: str
    title: str
    date: str
    start_time: str = Field(..., alias="startTime", serialization_alias="startTime")
    end_time: str = Field(..., alias="endTime", serialization_alias="endTime")
    color: str | None = None
    task_ids: list[str] = Field(default_factory=list, alias="taskIds", serialization_alias="taskIds")
    recurrence: str | None = None

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "TimeblockResponse":
        return cls(
            id=data["id"],
            title=data["title"],
            date=data["date"],
            startTime=data.get("start_time") or data.get("startTime", "09:00"),
            endTime=data.get("end_time") or data.get("endTime", "10:00"),
            color=data.get("color"),
            taskIds=data.get("task_ids") or data.get("taskIds") or [],
            recurrence=data.get("recurrence"),
        )


class TaskAllocationRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")

    task_id: str = Field(..., alias="taskId")
    action: str = Field(default="add", pattern=r"^(add|remove)$")
