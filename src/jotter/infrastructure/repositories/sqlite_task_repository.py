"""Repository for indexing and querying tasks in SQLite."""

import json
import sqlite3
from datetime import datetime, timezone
from typing import Any

from jotter.db import get_db
from jotter.domain.exceptions import EntityNotFoundError
from jotter.domain.task import Task
from jotter.domain.value_objects import DueDate, Priority, Tag, TaskId


class SqliteTaskRepository:
    def __init__(self, conn: sqlite3.Connection | None = None):
        self._conn = conn

    @property
    def conn(self) -> sqlite3.Connection:
        return self._conn if self._conn is not None else get_db()

    def upsert_task(self, task: Task) -> None:
        """Indexes or updates a task in SQLite."""
        cursor = self.conn.cursor()
        tags_json = json.dumps([t.value for t in task.tags])
        attachments_json = json.dumps(task.attachments)
        filename = f"{task.id}.md"

        cursor.execute(
            """
            INSERT INTO tasks (
                id, project_id, title, bucket, position, tags, attachments, filename, body,
                due_date, planned_date, priority, color, postponed_until, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                project_id = excluded.project_id,
                title = excluded.title,
                bucket = excluded.bucket,
                position = excluded.position,
                tags = excluded.tags,
                attachments = excluded.attachments,
                filename = excluded.filename,
                body = excluded.body,
                due_date = excluded.due_date,
                planned_date = excluded.planned_date,
                priority = excluded.priority,
                color = excluded.color,
                postponed_until = excluded.postponed_until,
                updated_at = excluded.updated_at
            """,
            (
                str(task.id),
                task.project_id,
                task.title,
                task.bucket,
                task.position,
                tags_json,
                attachments_json,
                filename,
                task.body or "",
                task.due_date.value,
                task.planned_date.value,
                task.priority.value if task.priority != Priority.NONE else None,
                task.color,
                task.postponed_until.value,
                task.created_at,
                task.updated_at,
            ),
        )

    def delete_task(self, task_id: str) -> None:
        cursor = self.conn.cursor()
        cursor.execute("DELETE FROM tasks WHERE id = ?", (task_id,))

    def get_by_id(self, project_id: str, task_id: str) -> Task:
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
    ) -> list[Task]:
        cursor = self.conn.cursor()
        query = """
        SELECT id, project_id, title, bucket, position, tags, attachments, body,
               due_date, planned_date, priority, color, postponed_until, created_at, updated_at
        FROM tasks
        WHERE 1=1
        """
        args: list[Any] = []
        today_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")

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

        # Sorting
        if project_id:
            query += " ORDER BY position ASC"
        else:
            query += " ORDER BY created_at DESC"

        cursor.execute(query, tuple(args))
        rows = cursor.fetchall()
        tasks = [self._row_to_task(row) for row in rows]

        # Tag in-memory filtering
        effective_tags = list(tags) if tags else ([tag] if tag else [])
        if effective_tags or search:
            filtered: list[Task] = []
            for t in tasks:
                task_tag_vals = [tag_obj.value for tag_obj in t.tags]

                if effective_tags:
                    filter_tags_lower = [ft.lower() for ft in effective_tags if ft]
                    if tag_mode == "all":
                        if not all(ft in task_tag_vals for ft in filter_tags_lower):
                            continue
                    else:  # any
                        if not any(ft in task_tag_vals for ft in filter_tags_lower):
                            continue

                if search:
                    s_lower = search.lower()
                    matches_title = s_lower in t.title.lower()
                    matches_body = s_lower in (t.body or "").lower()
                    matches_tags = any(s_lower in tv for tv in task_tag_vals)
                    if not (matches_title or matches_body or matches_tags):
                        continue

                filtered.append(t)
            return filtered

        return tasks

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
