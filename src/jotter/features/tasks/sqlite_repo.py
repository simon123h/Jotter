"""SQLite repository for indexing and querying tasks."""

import json
import re
import sqlite3
import threading
from datetime import UTC, datetime
from itertools import batched
from typing import Any, NamedTuple

from jotter.features.tasks.domain import DueDate, Priority, Tag, Task, TaskId
from jotter.shared.exceptions import EntityNotFoundError

_sqlite_write_lock = threading.Lock()


def _format_fts5_query(search: str) -> str | None:
    """Sanitizes and formats a free-text search string for SQLite FTS5 prefix matching."""
    cleaned = re.sub(r"[^\w\s]", " ", search, flags=re.UNICODE)
    tokens = [t.strip() for t in cleaned.split() if t.strip()]
    if not tokens:
        return None
    return " ".join(f'"{t}"*' for t in tokens)


class IndexedFile(NamedTuple):
    """What the SQLite index recorded about a task file when it was last read."""

    bucket: str
    created_at: str | None
    updated_at: str | None
    file_stat: tuple[int, int] | None


class SqliteTaskRepository:
    def __init__(self, conn: sqlite3.Connection):
        self.conn = conn
        from jotter.features.tasks.projector import TaskProjector

        self._projector = TaskProjector(conn)

    def upsert_task(self, task: Task, file_stat: tuple[int, int] | None = None) -> None:
        """Indexes or updates a task in SQLite via TaskProjector."""
        self._projector.project_task_upsert(task, file_stat)

    def delete_task(self, task_id: str) -> None:
        """Deletes a task from SQLite via TaskProjector."""
        self._projector.project_task_delete(task_id)

    def get_by_id(self, project_id: str, task_id: str) -> Task:
        if (
            not project_id
            or not isinstance(project_id, str)
            or not project_id.strip()
            or project_id in ("null", "undefined")
        ):
            raise EntityNotFoundError(f"Task '{task_id}' not found in project '{project_id}'")
        cursor = self.conn.cursor()
        cursor.execute(
            """
            SELECT id, project_id, title, bucket, position, tags, attachments, body,
                   due_date, planned_date, priority, color, postponed_until, created_at, updated_at
            FROM tasks
            WHERE project_id = ? AND id = ?
            """,
            (project_id, task_id),
        )
        row = cursor.fetchone()
        if not row:
            raise EntityNotFoundError(f"Task '{task_id}' not found in project '{project_id}'")
        return self._row_to_task(row)

    def get_by_ids(self, task_ids: list[str]) -> list[Task]:
        if not task_ids:
            return []
        cursor = self.conn.cursor()
        tasks: list[Task] = []
        for batch in batched(task_ids, 500):
            placeholders = ",".join(["?"] * len(batch))
            cursor.execute(
                f"""
                SELECT id, project_id, title, bucket, position, tags, attachments, body,
                       due_date, planned_date, priority, color, postponed_until, created_at, updated_at
                FROM tasks
                WHERE id IN ({placeholders})
                """,
                list(batch),
            )
            rows = cursor.fetchall()
            tasks.extend(self._row_to_task(row) for row in rows)
        return tasks

    def get_index_state(self, project_id: str) -> dict[str, IndexedFile]:
        """Returns what the index knows about each task file of a project, keyed by task ID."""
        rows = self.conn.execute(
            "SELECT id, bucket, created_at, updated_at, file_mtime_ns, file_size FROM tasks WHERE project_id = ?",
            (project_id,),
        ).fetchall()
        return {
            row["id"]: IndexedFile(
                bucket=row["bucket"],
                created_at=row["created_at"],
                updated_at=row["updated_at"],
                file_stat=(row["file_mtime_ns"], row["file_size"]) if row["file_mtime_ns"] is not None else None,
            )
            for row in rows
        }

    def get_task_ids(self, project_id: str) -> set[str]:
        """Returns the IDs of all indexed tasks of a project without materializing them."""
        rows = self.conn.execute("SELECT id FROM tasks WHERE project_id = ?", (project_id,)).fetchall()
        return {row["id"] for row in rows}

    def find_tasks(
        self,
        project_id: str | None = None,
        bucket: str | None = None,
        buckets: list[str] | None = None,
        tag: str | None = None,
        tags: list[str] | None = None,
        tag_mode: str = "any",
        exclude_bucket: str | None = None,
        exclude_buckets: list[str] | None = None,
        priorities: list[str] | None = None,
        search: str | None = None,
        due_before: str | None = None,
        due_after: str | None = None,
        planned_date: str | None = None,
        has_due_date: bool | None = None,
        created_before: str | None = None,
        created_after: str | None = None,
        updated_before: str | None = None,
        updated_after: str | None = None,
    ) -> list[Task]:
        cursor = self.conn.cursor()
        query = """
        SELECT id, project_id, title, bucket, position, tags, attachments, body,
               due_date, planned_date, priority, color, postponed_until, created_at, updated_at
        FROM tasks
        WHERE 1=1
        """
        args: list[Any] = []
        today_str = datetime.now(UTC).strftime("%Y-%m-%d")

        if project_id in ("null", "undefined"):
            return []

        if project_id:
            query += " AND project_id = ?"
            args.append(project_id)

        # Bucket filter
        if bucket:
            if bucket == "postponed":
                query += " AND postponed_until IS NOT NULL AND postponed_until > ?"
                args.append(today_str)
            else:
                query += " AND bucket = ? AND (postponed_until IS NULL OR postponed_until = '' OR postponed_until <= ?)"
                args.extend([bucket, today_str])
        elif buckets:
            has_postponed = "postponed" in buckets
            normal_buckets = [b for b in buckets if b != "postponed"]
            clauses: list[str] = []
            if normal_buckets:
                placeholders = ",".join("?" * len(normal_buckets))
                clauses.append(
                    f"(bucket IN ({placeholders}) AND (postponed_until IS NULL OR postponed_until = '' OR postponed_until <= ?))"
                )
                args.extend(normal_buckets)
                args.append(today_str)
            if has_postponed:
                clauses.append("(postponed_until IS NOT NULL AND postponed_until > ?)")
                args.append(today_str)
            if clauses:
                query += f" AND ({' OR '.join(clauses)})"
        else:
            exclude_postponed = False
            if exclude_bucket == "postponed":
                exclude_postponed = True
            if exclude_buckets and "postponed" in exclude_buckets:
                exclude_postponed = True
            if exclude_postponed:
                query += " AND (postponed_until IS NULL OR postponed_until = '' OR postponed_until <= ?)"
                args.append(today_str)

        # Exclude buckets
        if exclude_bucket and exclude_bucket != "postponed":
            query += " AND bucket != ?"
            args.append(exclude_bucket)

        if exclude_buckets:
            valid_excludes = [b.strip() for b in exclude_buckets if b.strip() and b.strip() != "postponed"]
            if valid_excludes:
                placeholders = ",".join("?" * len(valid_excludes))
                query += f" AND bucket NOT IN ({placeholders})"
                args.extend(valid_excludes)

        # Priorities
        if priorities:
            include_none = "none" in priorities or "" in priorities
            active_priorities = [p.strip() for p in priorities if p.strip() and p.strip() != "none"]
            sub_conditions: list[str] = []
            if include_none:
                sub_conditions.append("(priority IS NULL OR priority = '')")
            if active_priorities:
                placeholders = ",".join("?" * len(active_priorities))
                sub_conditions.append(f"priority IN ({placeholders})")
                args.extend(active_priorities)
            if sub_conditions:
                query += f" AND ({' OR '.join(sub_conditions)})"

        # Date filters
        if due_before:
            query += " AND due_date IS NOT NULL AND due_date <= ?"
            args.append(due_before)
        if due_after:
            query += " AND due_date IS NOT NULL AND due_date >= ?"
            args.append(due_after)
        if planned_date:
            query += " AND planned_date = ?"
            args.append(planned_date)
        if has_due_date is True:
            query += " AND due_date IS NOT NULL AND due_date != ''"
        elif has_due_date is False:
            query += " AND (due_date IS NULL OR due_date = '')"

        # Created date filters
        if created_before:
            # Match up to end of given date if YYYY-MM-DD
            c_before = f"{created_before}T23:59:59.999999" if len(created_before) == 10 else created_before
            query += " AND created_at <= ?"
            args.append(c_before)
        if created_after:
            c_after = f"{created_after}T00:00:00" if len(created_after) == 10 else created_after
            query += " AND created_at >= ?"
            args.append(c_after)

        # Updated date filters
        if updated_before:
            u_before = f"{updated_before}T23:59:59.999999" if len(updated_before) == 10 else updated_before
            query += " AND updated_at <= ?"
            args.append(u_before)
        if updated_after:
            u_after = f"{updated_after}T00:00:00" if len(updated_after) == 10 else updated_after
            query += " AND updated_at >= ?"
            args.append(u_after)

        # FTS5 full-text search across title, body, and tags
        if search:
            fts_query = _format_fts5_query(search)
            if fts_query:
                query += " AND tasks.rowid IN (SELECT rowid FROM tasks_fts WHERE tasks_fts MATCH ?)"
                args.append(fts_query)

        # Sorting
        if project_id:
            query += " ORDER BY position ASC"
        else:
            query += " ORDER BY created_at DESC"

        cursor.execute(query, tuple(args))
        rows = cursor.fetchall()
        tasks = [self._row_to_task(row) for row in rows]

        effective_tags = list(tags) if tags else ([tag] if tag else [])
        if not effective_tags:
            return tasks

        return [
            t
            for t in tasks
            if self._matches_tags(
                task=t,
                effective_tags=effective_tags,
                tag_mode=tag_mode,
            )
        ]

    def _matches_tags(
        self,
        task: Task,
        effective_tags: list[str],
        tag_mode: str,
    ) -> bool:
        """Predicate checking whether a task matches tag filters."""
        task_tag_vals = [tag_obj.value for tag_obj in task.tags]

        filter_tags_lower = [ft.lower() for ft in effective_tags if ft]
        if tag_mode == "all":
            if not all(ft in task_tag_vals for ft in filter_tags_lower):
                return False
        else:  # any
            if not any(ft in task_tag_vals for ft in filter_tags_lower):
                return False

        return True

    def _row_to_task(self, row: sqlite3.Row) -> Task:
        tags_raw = row["tags"]
        try:
            tags_list = json.loads(tags_raw) if tags_raw else []
        except Exception:
            tags_list = []

        attachments_raw = row["attachments"]
        try:
            attachments_list = json.loads(attachments_raw) if attachments_raw else []
        except Exception:
            attachments_list = []

        return Task(
            id=TaskId(row["id"]),
            project_id=row["project_id"],
            title=row["title"],
            bucket=row["bucket"],
            position=float(row["position"]),
            tags=[Tag(t) for t in tags_list if t],
            attachments=[str(a) for a in attachments_list if a],
            body=row["body"] or "",
            due_date=DueDate(row["due_date"]),
            planned_date=DueDate(row["planned_date"]),
            priority=Priority.from_str(row["priority"]),
            color=row["color"],
            postponed_until=DueDate(row["postponed_until"]),
            created_at=row["created_at"],
            updated_at=row["updated_at"],
        )
