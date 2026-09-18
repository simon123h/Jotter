"""Repository for managing projects on disk and SQLite."""

import shutil
import sqlite3
from pathlib import Path

from jotter.features.projects.domain import Project
from jotter.shared.exceptions import EntityNotFoundError


class ProjectRepository:
    def __init__(self, data_dir: Path | str, conn: sqlite3.Connection):
        self.data_dir = Path(data_dir) if data_dir else None
        self.conn = conn

    def exists(self, project_id: str) -> bool:
        cursor = self.conn.cursor()
        cursor.execute("SELECT 1 FROM projects WHERE id = ?", (project_id,))
        return cursor.fetchone() is not None

    def get(self, project_id: str) -> Project:
        cursor = self.conn.cursor()
        cursor.execute(
            """
            SELECT id, title, description, created_at, done_clean_period, git_remote
            FROM projects
            WHERE id = ?
            """,
            (project_id,),
        )
        row = cursor.fetchone()
        if not row:
            raise EntityNotFoundError(f"Project '{project_id}' not found")
        return self._row_to_project(row)

    def get_all(self) -> list[Project]:
        cursor = self.conn.cursor()
        cursor.execute("SELECT id, title, description, created_at, done_clean_period, git_remote FROM projects ORDER BY id ASC")
        rows = cursor.fetchall()
        return [self._row_to_project(row) for row in rows]

    def save(self, project: Project) -> None:
        if self.data_dir:
            proj_dir = self.data_dir / project.id
            proj_dir.mkdir(parents=True, exist_ok=True)
            # Sync index.md manifest
            cursor = self.conn.cursor()
            cursor.execute(
                """
                SELECT name, title, subtitle, position, color, layout, max_tasks, is_default
                FROM buckets
                WHERE project_id = ?
                ORDER BY position ASC
                """,
                (project.id,),
            )
            rows = cursor.fetchall()
            from jotter.features.buckets.domain import DEFAULT_DOMAIN_BUCKETS, Bucket
            from jotter.features.projects.manifest import write_project_manifest

            if rows:
                buckets = [
                    Bucket(
                        name=r["name"],
                        title=r["title"],
                        subtitle=r["subtitle"] or "",
                        position=float(r["position"]) if r["position"] is not None else 1000.0,
                        color=r["color"],
                        layout=r["layout"] or "list",
                        max_tasks=r["max_tasks"],
                        is_default=bool(r["is_default"]),
                    )
                    for r in rows
                ]
            else:
                buckets = [
                    Bucket(
                        name=b["name"],
                        title=b["title"],
                        subtitle=b.get("subtitle", ""),
                        position=float(b.get("position", 1000.0)),
                        color=b.get("color"),
                        layout=b.get("layout", "list"),
                        max_tasks=b.get("max_tasks"),
                        is_default=bool(b.get("is_default", False)),
                    )
                    for b in DEFAULT_DOMAIN_BUCKETS
                ]
            write_project_manifest(proj_dir, project, buckets)

        cursor = self.conn.cursor()
        cursor.execute(
            """
            INSERT INTO projects (id, title, description, created_at, done_clean_period, git_remote)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                title = excluded.title,
                description = excluded.description,
                done_clean_period = excluded.done_clean_period,
                git_remote = excluded.git_remote
            """,
            (
                project.id,
                project.name,
                project.description,
                project.created_at,
                project.done_clean_period,
                project.git_remote,
            ),
        )

    def delete(self, project_id: str) -> None:
        cursor = self.conn.cursor()
        cursor.execute("DELETE FROM projects WHERE id = ?", (project_id,))
        if self.data_dir:
            proj_dir = self.data_dir / project_id
            if proj_dir.is_dir():
                shutil.rmtree(proj_dir, ignore_errors=True)

    def count_tasks(self, project_id: str) -> int:
        cursor = self.conn.cursor()
        cursor.execute("SELECT COUNT(*) as cnt FROM tasks WHERE project_id = ?", (project_id,))
        row = cursor.fetchone()
        return int(row["cnt"]) if row else 0

    def discover_disk_projects(self) -> list[str]:
        """Discovers valid project folders on disk, including legacy projects.json definitions."""
        if not self.data_dir or not self.data_dir.is_dir():
            return []
        projects: set[str] = set()
        for entry in self.data_dir.iterdir():
            if entry.is_dir() and not entry.name.startswith(".") and entry.name != "tasks.db":
                projects.add(entry.name)

        legacy_file = self.data_dir / "projects.json"
        if legacy_file.is_file():
            try:
                import json
                content = json.loads(legacy_file.read_text(encoding="utf-8"))
                if isinstance(content, list):
                    for p in content:
                        if isinstance(p, dict) and p.get("id"):
                            projects.add(str(p["id"]).strip())
                elif isinstance(content, dict):
                    for k, v in content.items():
                        p_id = (v.get("id") if isinstance(v, dict) else None) or k
                        if p_id:
                            projects.add(str(p_id).strip())
            except Exception:
                pass

        return sorted(list(projects))

    def _row_to_project(self, row: sqlite3.Row) -> Project:
        return Project(
            id=row["id"],
            name=row["title"],
            description=row["description"] if "description" in row.keys() and row["description"] is not None else "",
            git_remote=row["git_remote"],
            done_clean_period=row["done_clean_period"] if "done_clean_period" in row.keys() else None,
            created_at=row["created_at"],
        )
