"""Repository for storing and retrieving time blocks from timeblocks.json."""

import json
from pathlib import Path
from typing import Any


class TimeblockDiskRepo:
    def __init__(self, data_dir: str | Path):
        self.data_dir = Path(data_dir)
        self.file_path = self.data_dir / "timeblocks.json"
        self.legacy_file_path = self.data_dir / "timeboxes.json"

    def _load(self) -> list[dict[str, Any]]:
        target_file = self.file_path if self.file_path.exists() else self.legacy_file_path
        if not target_file.exists():
            return []
        try:
            content = target_file.read_text(encoding="utf-8").strip()
            if not content:
                return []
            data = json.loads(content)
            return data if isinstance(data, list) else []
        except Exception:
            return []

    def _save(self, items: list[dict[str, Any]]) -> None:
        self.data_dir.mkdir(parents=True, exist_ok=True)
        temp_file = self.file_path.with_suffix(".tmp")
        temp_file.write_text(json.dumps(items, indent=2, ensure_ascii=False), encoding="utf-8")
        temp_file.replace(self.file_path)

    def list_all(self) -> list[dict[str, Any]]:
        return self._load()

    def get_by_id(self, timeblock_id: str) -> dict[str, Any] | None:
        for item in self._load():
            if item.get("id") == timeblock_id:
                return item
        return None

    def save(self, item: dict[str, Any]) -> dict[str, Any]:
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
