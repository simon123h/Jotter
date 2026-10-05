"""Pydantic schemas and DTOs for Application Settings."""

from pydantic import BaseModel, ConfigDict


class AppSettings(BaseModel):
    model_config = ConfigDict(extra="allow", populate_by_name=True)

    hideDoneColumn: bool = True
    hideArchiveColumn: bool = True
    hidePostponedColumn: bool = True
    isSidebarOpen: bool = True
    currentTheme: str = "nordic-light"
    thresholdDays: int = 7
    pinnedProjectIds: list[str] = []
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


class SettingsUpdate(BaseModel):
    model_config = ConfigDict(extra="allow", populate_by_name=True)

    hideDoneColumn: bool | None = None
    hideArchiveColumn: bool | None = None
    hidePostponedColumn: bool | None = None
    isSidebarOpen: bool | None = None
    currentTheme: str | None = None
    thresholdDays: int | None = None
    pinnedProjectIds: list[str] | None = None
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
