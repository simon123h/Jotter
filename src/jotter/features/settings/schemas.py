"""Pydantic schemas and DTOs for Application Settings."""

from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, field_validator, model_validator

# How far ahead planned tasks are shown (spec/FORMAT.md does not know it: it is a setting of the views)
PlanningHorizon = Literal["today", "tomorrow", "week", "month", "all"]


class SavedView(BaseModel):
    """A saved search: a name and a query of the search language (packages/task-filter), shown in the sidebar."""

    id: str
    name: str
    query: str


class AppSettings(BaseModel):
    model_config = ConfigDict(extra="allow", populate_by_name=True)

    hideDoneColumn: bool = True
    hideArchiveColumn: bool = True
    planningHorizon: PlanningHorizon = "today"
    # None: never set, so the apps offer their example views once; a list (also an empty one) is the user's choice
    views: list[SavedView] | None = None
    isSidebarOpen: bool = True
    currentTheme: str = "nordic-light"
    thresholdDays: int = 7
    pinnedProjectIds: list[str] = []
    captureProjectId: str | None = None
    sortBy: str = "alpha"
    hideAddTaskButton: bool = True
    projectOrder: list[str] = []
    windowWidth: int = 1200
    windowHeight: int = 800
    windowX: int = 0
    windowY: int = 0
    windowMaximized: bool = False
    language: str = "en"
    tagColors: dict[str, str] = {}
    doneCleanPeriod: int | None = None
    autoCommit: bool = True

    @field_validator("views", mode="before")
    @classmethod
    def _keep_the_valid_views(cls, value: Any) -> Any:
        """A view without an id, a name or a query is dropped, instead of failing all the settings."""
        if not isinstance(value, list):
            return None
        return [
            v
            for v in value
            if isinstance(v, dict) and all(isinstance(v.get(key), str) for key in ("id", "name", "query"))
        ]

    @model_validator(mode="before")
    @classmethod
    def _default_horizon(cls, data: Any) -> Any:
        """A value that is not a horizon falls back to the default."""
        if not isinstance(data, dict):
            return data
        data = dict(data)
        if data.get("planningHorizon") not in ("today", "tomorrow", "week", "month", "all"):
            data["planningHorizon"] = "today"
        return data


class SettingsUpdate(BaseModel):
    model_config = ConfigDict(extra="allow", populate_by_name=True)

    hideDoneColumn: bool | None = None
    hideArchiveColumn: bool | None = None
    planningHorizon: PlanningHorizon | None = None
    views: list[SavedView] | None = None
    isSidebarOpen: bool | None = None
    currentTheme: str | None = None
    thresholdDays: int | None = None
    pinnedProjectIds: list[str] | None = None
    captureProjectId: str | None = None
    sortBy: str | None = None
    hideAddTaskButton: bool | None = None
    projectOrder: list[str] | None = None
    windowWidth: int | None = None
    windowHeight: int | None = None
    windowX: int | None = None
    windowY: int | None = None
    windowMaximized: bool | None = None
    language: str | None = None
    tagColors: dict[str, str] | None = None
    doneCleanPeriod: int | None = None
    autoCommit: bool | None = None
