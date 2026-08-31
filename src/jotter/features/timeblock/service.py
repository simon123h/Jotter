import datetime
from typing import Any

from jotter.features.timeblock.repo import TimeblockDiskRepo
from jotter.features.timeblock.schemas import TimeblockCreate, TimeblockUpdate
from jotter.shared.exceptions import EntityNotFoundError, ValidationError
from jotter.shared.ulid import generate_ulid


def _matches_date(block: dict[str, Any], target_date: datetime.date) -> bool:
    rec = block.get("recurrence")
    if not rec or rec == "none":
        return block.get("date", "") == target_date.isoformat()

    anchor_str = block.get("date", "")
    if not anchor_str:
        return False
    try:
        anchor = datetime.date.fromisoformat(anchor_str)
    except ValueError:
        return False

    if target_date < anchor:
        return False

    if rec == "daily":
        return True
    elif rec == "weekdays":
        return target_date.isoweekday() <= 5  # Mon-Fri
    elif rec == "weekly":
        return (target_date - anchor).days % 7 == 0
    elif rec == "bi-weekly":
        return (target_date - anchor).days % 14 == 0
    return False


class TimeblockApplicationService:
    def __init__(self, repo: TimeblockDiskRepo):
        self.repo = repo

    def list_timeblocks(
        self,
        start_date: str | None = None,
        end_date: str | None = None,
    ) -> list[dict[str, Any]]:
        items = self.repo.list_all()

        if not start_date and not end_date:
            return sorted(items, key=lambda x: (x.get("date", ""), x.get("start_time") or x.get("startTime", "")))

        try:
            start_dt = datetime.date.fromisoformat(start_date) if start_date else None
            end_dt = datetime.date.fromisoformat(end_date) if end_date else None
        except ValueError:
            return []

        matched_results: list[dict[str, Any]] = []

        if start_dt and end_dt:
            curr = start_dt
            while curr <= end_dt:
                for tb in items:
                    if _matches_date(tb, curr):
                        # Create occurrence representation for curr date
                        item_copy = dict(tb)
                        item_copy["date"] = curr.isoformat()
                        matched_results.append(item_copy)
                curr += datetime.timedelta(days=1)
        elif start_dt:
            for tb in items:
                if _matches_date(tb, start_dt):
                    item_copy = dict(tb)
                    item_copy["date"] = start_dt.isoformat()
                    matched_results.append(item_copy)
        elif end_dt:
            for tb in items:
                if _matches_date(tb, end_dt):
                    item_copy = dict(tb)
                    item_copy["date"] = end_dt.isoformat()
                    matched_results.append(item_copy)

        # Sort by date and startTime
        return sorted(matched_results, key=lambda x: (x.get("date", ""), x.get("start_time") or x.get("startTime", "")))

    def get_timeblock(self, timeblock_id: str) -> dict[str, Any]:
        item = self.repo.get_by_id(timeblock_id)
        if not item:
            raise EntityNotFoundError(f"Timeblock '{timeblock_id}' not found")
        return item

    def create_timeblock(self, data: TimeblockCreate) -> dict[str, Any]:
        if data.start_time >= data.end_time:
            raise ValidationError("startTime must be earlier than endTime")

        timeblock_id = f"tb_{generate_ulid().lower()}"
        item: dict[str, Any] = {
            "id": timeblock_id,
            "title": data.title.strip(),
            "date": data.date,
            "start_time": data.start_time,
            "end_time": data.end_time,
            "color": data.color,
            "task_ids": data.task_ids or [],
            "recurrence": data.recurrence or None,
        }
        return self.repo.save(item)

    def update_timeblock(self, timeblock_id: str, data: TimeblockUpdate) -> dict[str, Any]:
        existing = self.get_timeblock(timeblock_id)

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
        recurrence = data.recurrence if data.recurrence is not None else existing.get("recurrence")

        if start_time >= end_time:
            raise ValidationError("startTime must be earlier than endTime")

        updated: dict[str, Any] = {
            "id": timeblock_id,
            "title": title,
            "date": date,
            "start_time": start_time,
            "end_time": end_time,
            "color": color,
            "task_ids": task_ids,
            "recurrence": recurrence or None,
        }
        return self.repo.save(updated)

    def delete_timeblock(self, timeblock_id: str) -> None:
        deleted = self.repo.delete(timeblock_id)
        if not deleted:
            raise EntityNotFoundError(f"Timeblock '{timeblock_id}' not found")

    def allocate_task(self, timeblock_id: str, task_id: str, action: str = "add") -> dict[str, Any]:
        target_tb = self.get_timeblock(timeblock_id)
        all_boxes = self.repo.list_all()

        # If adding, remove task from any other box first so task belongs to max 1 time block
        if action == "add":
            for tb in all_boxes:
                if tb.get("id") != timeblock_id:
                    ids = tb.get("task_ids", [])
                    if task_id in ids:
                        tb["task_ids"] = [t for t in ids if t != task_id]
                        self.repo.save(tb)

            target_tb = self.get_timeblock(timeblock_id)
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

        return self.get_timeblock(timeblock_id)

    # Aliases
    list_timeboxes = list_timeblocks
    get_timebox = get_timeblock
    create_timebox = create_timeblock
    update_timebox = update_timeblock
    delete_timebox = delete_timeblock


# Backwards compatibility alias
TimeboxApplicationService = TimeblockApplicationService
