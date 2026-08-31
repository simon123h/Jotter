"""FastAPI routes for Timeblock management."""

from fastapi import APIRouter, Depends, Query

from jotter.features.timeblock.repo import TimeblockDiskRepo
from jotter.features.timeblock.schemas import (
    TaskAllocationRequest,
    TimeblockCreate,
    TimeblockResponse,
    TimeblockUpdate,
)
from jotter.features.timeblock.service import TimeblockApplicationService
from jotter.shared.deps import get_data_dir

router = APIRouter(prefix="/api/timeblocks", tags=["timeblocks"])


def get_timeblock_service(data_dir: str = Depends(get_data_dir)) -> TimeblockApplicationService:
    repo = TimeblockDiskRepo(data_dir)
    return TimeblockApplicationService(repo)


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


# Legacy router for /api/timeboxes backwards compatibility
legacy_router = APIRouter(prefix="/api/timeboxes", tags=["timeblocks"])


@legacy_router.get("", response_model=list[TimeblockResponse], include_in_schema=False)
def legacy_list_timeboxes(
    start_date: str | None = Query(default=None, alias="startDate"),
    end_date: str | None = Query(default=None, alias="endDate"),
    svc: TimeblockApplicationService = Depends(get_timeblock_service),
):
    return list_timeblocks(start_date, end_date, svc)


@legacy_router.get("/{timeblock_id}", response_model=TimeblockResponse, include_in_schema=False)
def legacy_get_timebox(timeblock_id: str, svc: TimeblockApplicationService = Depends(get_timeblock_service)):
    return get_timeblock(timeblock_id, svc)


@legacy_router.post("", response_model=TimeblockResponse, status_code=201, include_in_schema=False)
def legacy_create_timebox(req: TimeblockCreate, svc: TimeblockApplicationService = Depends(get_timeblock_service)):
    return create_timeblock(req, svc)


@legacy_router.put("/{timeblock_id}", response_model=TimeblockResponse, include_in_schema=False)
def legacy_update_timebox(
    timeblock_id: str,
    req: TimeblockUpdate,
    svc: TimeblockApplicationService = Depends(get_timeblock_service),
):
    return update_timeblock(timeblock_id, req, svc)


@legacy_router.delete("/{timeblock_id}", status_code=204, include_in_schema=False)
def legacy_delete_timebox(timeblock_id: str, svc: TimeblockApplicationService = Depends(get_timeblock_service)):
    return delete_timeblock(timeblock_id, svc)


@legacy_router.post("/{timeblock_id}/tasks", response_model=TimeblockResponse, include_in_schema=False)
def legacy_allocate_task(
    timeblock_id: str,
    req: TaskAllocationRequest,
    svc: TimeblockApplicationService = Depends(get_timeblock_service),
):
    return allocate_task(timeblock_id, req, svc)
