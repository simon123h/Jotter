"""Sync & Git feature package."""

from jotter.features.sync.git_adapter import (
    commit_changes,
    enable_git_versioning,
    get_git_history,
    git_commit,
    git_restore,
    init_git_repo,
    is_git_installed,
    is_git_repo,
)
from jotter.features.sync.router import router
from jotter.features.sync.service import SyncApplicationService
from jotter.features.sync.watcher import FileWatcherService

__all__ = [
    "SyncApplicationService",
    "FileWatcherService",
    "is_git_installed",
    "is_git_repo",
    "init_git_repo",
    "git_commit",
    "commit_changes",
    "enable_git_versioning",
    "get_git_history",
    "git_restore",
    "router",
]
