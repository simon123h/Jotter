from pydantic import BaseModel


class AppSettings(BaseModel):
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
    gitRemoteUrl: str = ""
    language: str = "en"
    tagColors: dict[str, str] = {}
    autoSyncInterval: int = 0
