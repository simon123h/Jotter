"""Sync service facade delegating to features.sync."""

from jotter.features.sync.service import SyncApplicationService


def sync_db_only(data_dir: str) -> int:
    return SyncApplicationService(data_dir).sync_db_only()


def full_sync(data_dir: str) -> int:
    return SyncApplicationService(data_dir).full_sync()
