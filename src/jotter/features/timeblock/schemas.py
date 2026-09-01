"""Pydantic schemas for Timeblock feature."""

from typing import Any

from pydantic import BaseModel, ConfigDict, Field

from jotter.features.tasks.schemas import TaskResponse


class TimeblockBase(BaseModel):
    model_config = ConfigDict(extra="ignore")

    title: str = Field(..., min_length=1, max_length=200)
    date: str = Field(..., pattern=r"^\d{4}-\d{2}-\d{2}$")
    start_time: str = Field(..., pattern=r"^\d{2}:\d{2}$")
    end_time: str = Field(..., pattern=r"^\d{2}:\d{2}$")
    color: str | None = None
    task_ids: list[str] = Field(default_factory=list)
    recurrence: str | None = Field(default=None, pattern=r"^(none|daily|weekdays|weekly|bi-weekly)?$")


class TimeblockCreate(TimeblockBase):
    pass


class TimeblockUpdate(BaseModel):
    model_config = ConfigDict(extra="ignore")

    title: str | None = Field(default=None, min_length=1, max_length=200)
    date: str | None = Field(default=None, pattern=r"^\d{4}-\d{2}-\d{2}$")
    start_time: str | None = Field(default=None, pattern=r"^\d{2}:\d{2}$")
    end_time: str | None = Field(default=None, pattern=r"^\d{2}:\d{2}$")
    color: str | None = None
    task_ids: list[str] | None = None
    recurrence: str | None = Field(default=None, pattern=r"^(none|daily|weekdays|weekly|bi-weekly)?$")


class TimeblockResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    title: str
    date: str
    start_time: str
    end_time: str
    color: str | None = None
    task_ids: list[str] = Field(default_factory=list)
    tasks: list[TaskResponse] = Field(default_factory=list)
    recurrence: str | None = None

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "TimeblockResponse":
        raw_tasks = data.get("tasks") or []
        parsed_tasks: list[TaskResponse] = []
        for t in raw_tasks:
            if isinstance(t, TaskResponse):
                parsed_tasks.append(t)
            elif isinstance(t, dict):
                parsed_tasks.append(TaskResponse.model_validate(t))
            elif hasattr(t, "id"):  # Task domain model
                parsed_tasks.append(
                    TaskResponse(
                        id=str(t.id),
                        project_id=t.project_id,
                        title=t.title,
                        bucket=t.bucket,
                        position=t.position,
                        tags=[tag.value for tag in t.tags],
                        attachments=t.attachments,
                        body=t.body,
                        due_date=t.due_date.value,
                        planned_date=t.planned_date.value,
                        priority=t.priority.value if t.priority.value != "none" else None,
                        color=t.color,
                        postponed_until=t.postponed_until.value,
                        created_at=t.created_at,
                        updated_at=t.updated_at,
                    )
                )

        return cls(
            id=data["id"],
            title=data["title"],
            date=data["date"],
            start_time=data.get("start_time") or data.get("startTime", "09:00"),
            end_time=data.get("end_time") or data.get("endTime", "10:00"),
            color=data.get("color"),
            task_ids=data.get("task_ids") or data.get("taskIds") or [],
            tasks=parsed_tasks,
            recurrence=data.get("recurrence"),
        )


class TaskAllocationRequest(BaseModel):
    model_config = ConfigDict(extra="ignore")

    task_id: str
    action: str = Field(default="add", pattern=r"^(add|remove)$")
