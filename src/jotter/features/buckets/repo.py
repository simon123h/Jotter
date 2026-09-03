"""Repository for managing bucket columns on disk (buckets.json) and SQLite."""

import json
import sqlite3
from pathlib import Path
from typing import Any

from jotter.features.buckets.domain import DEFAULT_DOMAIN_BUCKETS, Bucket
from jotter.shared.exceptions import EntityNotFoundError


class BucketRepository:
    def __init__(self, data_dir: Path | str, conn: sqlite3.Connection):
        self.data_dir = Path(data_dir) if data_dir else None
        self.conn = conn

    def get_project_dir(self, project_id: str) -> Path | None:
        if (
            not self.data_dir
            or not project_id
            or not isinstance(project_id, str)
            or not project_id.strip()
            or project_id in ("null", "undefined")
        ):
            return None
        p = self.data_dir / project_id
        p.mkdir(parents=True, exist_ok=True)
        return p

    def get_all(self, project_id: str) -> list[Bucket]:
        if (
            not project_id
            or not isinstance(project_id, str)
            or not project_id.strip()
            or project_id in ("null", "undefined")
        ):
            return []
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
        if (
            not project_id
            or not isinstance(project_id, str)
            or not project_id.strip()
            or project_id in ("null", "undefined")
        ):
            raise EntityNotFoundError(f"Column '{name}' not found in project '{project_id}'")
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
            # Unset is_default on other buckets for this project
            cursor.execute(
                "UPDATE buckets SET is_default = 0 WHERE project_id = ? AND name != ?",
                (project_id, bucket.name),
            )

        cursor.execute(
            """
            INSERT INTO buckets (project_id, name, title, subtitle, position, color, layout, max_tasks, is_default)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
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
        cursor.execute(
            "DELETE FROM buckets WHERE project_id = ? AND name = ?",
            (project_id, name),
        )
        self.sync_buckets_file(project_id)

    def count_tasks_in_bucket(self, project_id: str, bucket_name: str) -> int:
        cursor = self.conn.cursor()
        cursor.execute(
            "SELECT COUNT(*) as cnt FROM tasks WHERE project_id = ? AND bucket = ?",
            (project_id, bucket_name),
        )
        row = cursor.fetchone()
        return int(row["cnt"]) if row else 0

    def sync_buckets_file(self, project_id: str) -> None:
        """Persists current SQLite buckets configuration to disk `buckets.json`."""
        proj_dir = self.get_project_dir(project_id)
        if not proj_dir:
            return

        buckets = self.get_all(project_id)
        data = [
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
        self.write_buckets_file(project_id, data)

    def load_buckets_file(self, project_id: str) -> list[dict[str, Any]]:
        proj_dir = self.get_project_dir(project_id)
        if not proj_dir:
            return DEFAULT_DOMAIN_BUCKETS

        file_path = proj_dir / "buckets.json"
        if not file_path.is_file():
            self.write_buckets_file(project_id, DEFAULT_DOMAIN_BUCKETS)
            return DEFAULT_DOMAIN_BUCKETS

        try:
            with open(file_path, encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return DEFAULT_DOMAIN_BUCKETS

    def write_buckets_file(self, project_id: str, buckets: list[dict[str, Any]]) -> None:
        proj_dir = self.get_project_dir(project_id)
        if not proj_dir:
            return
        file_path = proj_dir / "buckets.json"
        tmp_path = file_path.with_suffix(".tmp")
        with open(tmp_path, "w", encoding="utf-8") as f:
            json.dump(buckets, f, indent=2)
        tmp_path.replace(file_path)

    def _row_to_bucket(self, row: sqlite3.Row) -> Bucket:
        pos = row["position"]
        return Bucket(
            name=row["name"],
            title=row["title"],
            subtitle=row["subtitle"] or "",
            position=float(pos) if pos is not None else 1000.0,
            color=row["color"],
            layout=row["layout"] or "list",
            max_tasks=row["max_tasks"],
            is_default=bool(row["is_default"]),
        )
