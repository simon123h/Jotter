"""Repository for storing and retrieving time blocks from timeblocks.json."""

import json
from pathlib import Path
from typing import cast

from jotter.features.timeblock.schemas import TimeblockRecord


class TimeblockDiskRepo:
    def __init__(self, data_dir: str | Path):
        self.data_dir = Path(data_dir)
        self.file_path = self.data_dir / "timeblocks.json"

    def _load(self) -> list[TimeblockRecord]:
        if not self.file_path.exists():
            return []
        try:
            content = self.file_path.read_text(encoding="utf-8").strip()
            if not content:
                return []
            data = json.loads(content)
            return cast(list[TimeblockRecord], data) if isinstance(data, list) else []
        except Exception:
            return []

    def _save(self, items: list[TimeblockRecord]) -> None:
        from jotter.shared.fs import atomic_write

        cleaned_items = [{k: v for k, v in it.items() if k != "tasks"} for it in items]
        data_str = json.dumps(cleaned_items, indent=2, ensure_ascii=False)
        atomic_write(self.file_path, data_str, encoding="utf-8", prefix=".timeblocks_", suffix=".tmp")

    def list_all(self) -> list[TimeblockRecord]:
        return self._load()

    def get_by_id(self, timeblock_id: str) -> TimeblockRecord | None:
        for item in self._load():
            if item.get("id") == timeblock_id:
                return item
        return None

    def save(self, item: TimeblockRecord) -> TimeblockRecord:
        items = self._load()
        idx = next((i for i, tb in enumerate(items) if tb.get("id") == item.get("id")), None)
        if idx is not None:
            items[idx] = item
        else:
            items.append(item)
        self._save(items)
        return item

    def delete(self, timeblock_id: str) -> bool:
        items = self._load()
        new_items = [tb for tb in items if tb.get("id") != timeblock_id]
        if len(new_items) != len(items):
            self._save(new_items)
            return True
        return False
