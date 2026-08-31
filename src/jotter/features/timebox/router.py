"""FastAPI routes for Timebox management."""

from fastapi import APIRouter, Depends, Query

from jotter.features.timebox.repo import TimeboxDiskRepo
from jotter.features.timebox.schemas import (
    TaskAllocationRequest,
    TimeboxCreate,
    TimeboxResponse,
    TimeboxUpdate,
)
from jotter.features.timebox.service import TimeboxApplicationService
from jotter.shared.deps import get_data_dir

router = APIRouter(prefix="/api/timeboxes", tags=["timeboxes"])


def get_timebox_service(data_dir: str = Depends(get_data_dir)) -> TimeboxApplicationService:
    repo = TimeboxDiskRepo(data_dir)
    return TimeboxApplicationService(repo)


@router.get("", response_model=list[TimeboxResponse])
def list_timeboxes(
    start_date: str | None = Query(default=None, alias="startDate"),
    end_date: str | None = Query(default=None, alias="endDate"),
    svc: TimeboxApplicationService = Depends(get_timebox_service),
):
    items = svc.list_timeboxes(start_date, end_date)
    return [TimeboxResponse.from_dict(item) for item in items]


@router.get("/{timebox_id}", response_model=TimeboxResponse)
def get_timebox(timebox_id: str, svc: TimeboxApplicationService = Depends(get_timebox_service)):
    item = svc.get_timebox(timebox_id)
    return TimeboxResponse.from_dict(item)


@router.post("", response_model=TimeboxResponse, status_code=201)
def create_timebox(req: TimeboxCreate, svc: TimeboxApplicationService = Depends(get_timebox_service)):
    created = svc.create_timebox(req)
    return TimeboxResponse.from_dict(created)


@router.put("/{timebox_id}", response_model=TimeboxResponse)
def update_timebox(
    timebox_id: str,
    req: TimeboxUpdate,
    svc: TimeboxApplicationService = Depends(get_timebox_service),
):
    updated = svc.update_timebox(timebox_id, req)
    return TimeboxResponse.from_dict(updated)


@router.delete("/{timebox_id}", status_code=204)
def delete_timebox(timebox_id: str, svc: TimeboxApplicationService = Depends(get_timebox_service)):
    svc.delete_timebox(timebox_id)
    return None


@router.post("/{timebox_id}/tasks", response_model=TimeboxResponse)
def allocate_task(
    timebox_id: str,
    req: TaskAllocationRequest,
    svc: TimeboxApplicationService = Depends(get_timebox_service),
):
    updated = svc.allocate_task(timebox_id, req.task_id, req.action)
    return TimeboxResponse.from_dict(updated)
