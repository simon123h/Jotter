import sqlite3

from fastapi import APIRouter, Depends, Query

from jotter.features.tasks.sqlite_repo import SqliteTaskRepository
from jotter.features.timeblock.repo import TimeblockDiskRepo
from jotter.features.timeblock.schemas import (
    TaskAllocationRequest,
    TimeblockCreate,
    TimeblockResponse,
    TimeblockUpdate,
)
from jotter.features.timeblock.service import TimeblockApplicationService
from jotter.shared.deps import get_data_dir, get_db_conn

router = APIRouter(prefix="/api/timeblocks", tags=["timeblocks"])


def get_timeblock_service(
    data_dir: str = Depends(get_data_dir),
    db: sqlite3.Connection = Depends(get_db_conn),
) -> TimeblockApplicationService:
    repo = TimeblockDiskRepo(data_dir)
    task_repo = SqliteTaskRepository(db)
    return TimeblockApplicationService(repo, task_repo)


@router.get("", response_model=list[TimeblockResponse])
def list_timeblocks(
    start_date: str | None = Query(default=None, alias="startDate"),
    end_date: str | None = Query(default=None, alias="endDate"),
    svc: TimeblockApplicationService = Depends(get_timeblock_service),
):
    items = svc.list_timeblocks(start_date, end_date)
    return [TimeblockResponse.from_dict(item) for item in items]


@router.get("/{timeblock_id}", response_model=TimeblockResponse)
def get_timeblock(timeblock_id: str, svc: TimeblockApplicationService = Depends(get_timeblock_service)):
    item = svc.get_timeblock(timeblock_id)
    return TimeblockResponse.from_dict(item)


@router.post("", response_model=TimeblockResponse, status_code=201)
def create_timeblock(req: TimeblockCreate, svc: TimeblockApplicationService = Depends(get_timeblock_service)):
    created = svc.create_timeblock(req)
    return TimeblockResponse.from_dict(created)


@router.put("/{timeblock_id}", response_model=TimeblockResponse)
def update_timeblock(
    timeblock_id: str,
    req: TimeblockUpdate,
    svc: TimeblockApplicationService = Depends(get_timeblock_service),
):
    updated = svc.update_timeblock(timeblock_id, req)
    return TimeblockResponse.from_dict(updated)


@router.delete("/{timeblock_id}", status_code=204)
def delete_timeblock(timeblock_id: str, svc: TimeblockApplicationService = Depends(get_timeblock_service)):
    svc.delete_timeblock(timeblock_id)
    return None


@router.post("/{timeblock_id}/tasks", response_model=TimeblockResponse)
def allocate_task(
    timeblock_id: str,
    req: TaskAllocationRequest,
    svc: TimeblockApplicationService = Depends(get_timeblock_service),
):
    updated = svc.allocate_task(timeblock_id, req.task_id, req.action)
    return TimeblockResponse.from_dict(updated)
