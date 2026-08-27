"""Repository for managing bucket columns on disk (buckets.json) and SQLite."""

import json
import sqlite3
from pathlib import Path
from typing import Any

from jotter.features.buckets.domain import DEFAULT_DOMAIN_BUCKETS, Bucket
from jotter.shared.db import get_db
from jotter.shared.exceptions import EntityNotFoundError


class BucketRepository:
    def __init__(self, data_dir: str = "", conn: sqlite3.Connection | None = None):
        self.data_dir = Path(data_dir) if data_dir else None
        self._conn = conn

    @property
    def conn(self) -> sqlite3.Connection:
        return self._conn if self._conn is not None else get_db()

    def get_project_dir(self, project_id: str) -> Path | None:
        if not self.data_dir:
            return None
        p = self.data_dir / project_id
        p.mkdir(parents=True, exist_ok=True)
        return p

    def get_all(self, project_id: str) -> list[Bucket]:
        cursor = self.conn.cursor()
        cursor.execute(
            """
            SELECT name, title, subtitle, position, color, layout, max_tasks, is_default
            FROM buckets
            WHERE project_id = ?
            ORDER BY position ASC
            """,
            (project_id,),
        )
        rows = cursor.fetchall()
        return [self._row_to_bucket(row) for row in rows]

    def get(self, project_id: str, name: str) -> Bucket:
        cursor = self.conn.cursor()
        cursor.execute(
            """
            SELECT name, title, subtitle, position, color, layout, max_tasks, is_default
            FROM buckets
            WHERE project_id = ? AND name = ?
            """,
            (project_id, name),
        )
        row = cursor.fetchone()
        if not row:
            raise EntityNotFoundError(f"Column '{name}' not found in project '{project_id}'")
        return self._row_to_bucket(row)

    def save(self, project_id: str, bucket: Bucket) -> None:
        cursor = self.conn.cursor()
        if bucket.is_default:
            cursor.execute("UPDATE buckets SET is_default = 0 WHERE project_id = ?", (project_id,))

        cursor.execute(
            """
            INSERT INTO buckets (
                project_id, name, title, subtitle, position, color, layout, max_tasks, is_default
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(project_id, name) DO UPDATE SET
                title = excluded.title,
                subtitle = excluded.subtitle,
                position = excluded.position,
                color = excluded.color,
                layout = excluded.layout,
                max_tasks = excluded.max_tasks,
                is_default = excluded.is_default
            """,
            (
                project_id,
                bucket.name,
                bucket.title,
                bucket.subtitle,
                bucket.position,
                bucket.color,
                bucket.layout,
                bucket.max_tasks,
                1 if bucket.is_default else 0,
            ),
        )
        self.sync_buckets_file(project_id)

    def delete(self, project_id: str, name: str) -> None:
        cursor = self.conn.cursor()
        cursor.execute("DELETE FROM buckets WHERE project_id = ? AND name = ?", (project_id, name))
        self.sync_buckets_file(project_id)

    def count_tasks_in_bucket(self, project_id: str, name: str) -> int:
        cursor = self.conn.cursor()
        cursor.execute("SELECT COUNT(*) as cnt FROM tasks WHERE project_id = ? AND bucket = ?", (project_id, name))
        row = cursor.fetchone()
        return int(row["cnt"]) if row else 0

    def load_buckets_file(self, project_id: str) -> list[dict[str, Any]]:
        project_dir = self.get_project_dir(project_id)
        if not project_dir:
            return DEFAULT_DOMAIN_BUCKETS
        buckets_file = project_dir / "buckets.json"

        if not buckets_file.is_file():
            self.write_buckets_file(project_id, DEFAULT_DOMAIN_BUCKETS)
            return DEFAULT_DOMAIN_BUCKETS

        try:
            with open(buckets_file, encoding="utf-8") as f:
                data = json.load(f)
                if isinstance(data, list) and len(data) > 0:
                    return data
        except Exception:
            pass

        self.write_buckets_file(project_id, DEFAULT_DOMAIN_BUCKETS)
        return DEFAULT_DOMAIN_BUCKETS

    def write_buckets_file(self, project_id: str, buckets: list[dict[str, Any]]) -> None:
        project_dir = self.get_project_dir(project_id)
        if not project_dir:
            return
        buckets_file = project_dir / "buckets.json"
        tmp_file = buckets_file.with_suffix(".tmp")
        with open(tmp_file, "w", encoding="utf-8") as f:
            json.dump(buckets, f, indent=2)
        tmp_file.replace(buckets_file)

    def sync_buckets_file(self, project_id: str) -> None:
        if not self.data_dir:
            return
        buckets = self.get_all(project_id)
        buckets_data = [
            {
                "name": b.name,
                "title": b.title,
                "subtitle": b.subtitle,
                "position": b.position,
                "color": b.color,
                "layout": b.layout,
                "max_tasks": b.max_tasks,
                "is_default": b.is_default,
            }
            for b in buckets
        ]
        self.write_buckets_file(project_id, buckets_data)

    def _row_to_bucket(self, row: sqlite3.Row) -> Bucket:
        return Bucket(
            name=row["name"],
            title=row["title"],
            subtitle=row["subtitle"] or "",
            position=float(row["position"]),
            color=row["color"],
            layout=row["layout"] or "list",
            max_tasks=row["max_tasks"],
            is_default=bool(row["is_default"]),
        )
