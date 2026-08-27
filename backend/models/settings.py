from typing import Dict, List
from pydantic import BaseModel


class AppSettings(BaseModel):
    hideDoneColumn: bool = True
    hideArchiveColumn: bool = True
    hidePostponedColumn: bool = True
    isSidebarOpen: bool = True
    currentTheme: str = "nordic-light"
    thresholdDays: int = 7
    pinnedProjectIds: List[str] = []
    sortBy: str = "alpha"
    hideAddTaskButton: bool = True
    projectOrder: List[str] = []
    windowWidth: int = 1200
    windowHeight: int = 800
    windowX: int = 0
    windowY: int = 0
    windowMaximized: bool = False
    gitRemoteUrl: str = ""
    language: str = "en"
    tagColors: Dict[str, str] = {}
    autoSyncInterval: int = 0
