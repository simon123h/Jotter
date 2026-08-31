"""Service layer for managing Timebox operations."""

from typing import Any

from jotter.features.timebox.repo import TimeboxDiskRepo
from jotter.features.timebox.schemas import TimeboxCreate, TimeboxUpdate
from jotter.shared.exceptions import EntityNotFoundError, ValidationError
from jotter.shared.ulid import generate_ulid


class TimeboxApplicationService:
    def __init__(self, repo: TimeboxDiskRepo):
        self.repo = repo

    def list_timeboxes(
        self,
        start_date: str | None = None,
        end_date: str | None = None,
    ) -> list[dict[str, Any]]:
        items = self.repo.list_all()
        if start_date:
            items = [tb for tb in items if tb.get("date", "") >= start_date]
        if end_date:
            items = [tb for tb in items if tb.get("date", "") <= end_date]

        # Sort by date and startTime
        return sorted(items, key=lambda x: (x.get("date", ""), x.get("start_time") or x.get("startTime", "")))

    def get_timebox(self, timebox_id: str) -> dict[str, Any]:
        item = self.repo.get_by_id(timebox_id)
        if not item:
            raise EntityNotFoundError(f"Timebox '{timebox_id}' not found")
        return item

    def create_timebox(self, data: TimeboxCreate) -> dict[str, Any]:
        if data.start_time >= data.end_time:
            raise ValidationError("startTime must be earlier than endTime")

        timebox_id = f"tb_{generate_ulid().lower()}"
        item: dict[str, Any] = {
            "id": timebox_id,
            "title": data.title.strip(),
            "date": data.date,
            "start_time": data.start_time,
            "end_time": data.end_time,
            "color": data.color,
            "task_ids": data.task_ids or [],
        }
        return self.repo.save(item)

    def update_timebox(self, timebox_id: str, data: TimeboxUpdate) -> dict[str, Any]:
        existing = self.get_timebox(timebox_id)

        title = data.title.strip() if data.title is not None else existing.get("title", "")
        date = data.date if data.date is not None else existing.get("date", "")
        start_time = (
            data.start_time
            if data.start_time is not None
            else existing.get("start_time") or existing.get("startTime", "09:00")
        )
        end_time = (
            data.end_time if data.end_time is not None else existing.get("end_time") or existing.get("endTime", "10:00")
        )
        color = data.color if data.color is not None else existing.get("color")
        task_ids = data.task_ids if data.task_ids is not None else existing.get("task_ids", [])

        if start_time >= end_time:
            raise ValidationError("startTime must be earlier than endTime")

        updated: dict[str, Any] = {
            "id": timebox_id,
            "title": title,
            "date": date,
            "start_time": start_time,
            "end_time": end_time,
            "color": color,
            "task_ids": task_ids,
        }
        return self.repo.save(updated)

    def delete_timebox(self, timebox_id: str) -> None:
        deleted = self.repo.delete(timebox_id)
        if not deleted:
            raise EntityNotFoundError(f"Timebox '{timebox_id}' not found")

    def allocate_task(self, timebox_id: str, task_id: str, action: str = "add") -> dict[str, Any]:
        target_tb = self.get_timebox(timebox_id)
        all_boxes = self.repo.list_all()

        # If adding, remove task from any other box first so task belongs to max 1 timebox
        if action == "add":
            for tb in all_boxes:
                if tb.get("id") != timebox_id:
                    ids = tb.get("task_ids", [])
                    if task_id in ids:
                        tb["task_ids"] = [t for t in ids if t != task_id]
                        self.repo.save(tb)

            target_tb = self.get_timebox(timebox_id)
            current_ids = target_tb.get("task_ids", [])
            if task_id not in current_ids:
                current_ids.append(task_id)
                target_tb["task_ids"] = current_ids
                self.repo.save(target_tb)
        elif action == "remove":
            current_ids = target_tb.get("task_ids", [])
            if task_id in current_ids:
                target_tb["task_ids"] = [t for t in current_ids if t != task_id]
                self.repo.save(target_tb)

        return self.get_timebox(timebox_id)
