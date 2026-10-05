"""Projector service for projecting task aggregates into the SQLite read-model index."""

import json
import sqlite3
import threading

from jotter.features.tasks.domain import Priority, Task

_sqlite_write_lock = threading.Lock()


class TaskProjector:
    """Synchronous in-process projector that maintains the SQLite query read-model.

    Invoked both by internal Command services (immediate read-your-own-writes consistency)
    and by external file synchronizers (FileWatcherService, SyncApplicationService).
    """

    def __init__(self, conn: sqlite3.Connection):
        self.conn = conn

    def max_position(self, project_id: str, bucket: str) -> float | None:
        """Returns the highest task position in a bucket, or None if the bucket has no tasks.

        Answered from the index, so callers need not open and parse every task file.
        """
        row = self.conn.execute(
            "SELECT MAX(position) FROM tasks WHERE project_id = ? AND bucket = ?", (project_id, bucket)
        ).fetchone()
        return None if row is None or row[0] is None else float(row[0])

    def project_task_upsert(self, task: Task, file_stat: tuple[int, int] | None = None) -> None:
        """Projects a Task domain aggregate into the tasks table and FTS5 search index.

        An unchanged task is left untouched, so re-projecting it does not rewrite its FTS entry.
        `file_stat` is the (mtime_ns, size) of the task file the task was read from; it lets a later sync skip the
        file while it is unchanged. Without it the stored stat is cleared, as it no longer describes the file.
        """
        tags_json = json.dumps([t.value for t in task.tags])
        attachments_json = json.dumps(task.attachments)
        filename = f"{task.id}.md"

        with _sqlite_write_lock:
            cursor = self.conn.cursor()
            cursor.execute(
                """
                INSERT INTO tasks (
                    id, project_id, title, bucket, position, tags, attachments, filename, body,
                    due_date, planned_date, priority, color, postponed_until, created_at, updated_at,
                    file_mtime_ns, file_size
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
                    updated_at = excluded.updated_at,
                    file_mtime_ns = excluded.file_mtime_ns,
                    file_size = excluded.file_size
                WHERE (
                    tasks.project_id, tasks.title, tasks.bucket, tasks.position, tasks.tags, tasks.attachments,
                    tasks.filename, tasks.body, tasks.due_date, tasks.planned_date, tasks.priority, tasks.color,
                    tasks.postponed_until, tasks.updated_at,
                    tasks.file_mtime_ns, tasks.file_size
                ) IS NOT (
                    excluded.project_id, excluded.title, excluded.bucket, excluded.position, excluded.tags,
                    excluded.attachments, excluded.filename, excluded.body, excluded.due_date,
                    excluded.planned_date, excluded.priority, excluded.color, excluded.postponed_until,
                    excluded.updated_at, excluded.file_mtime_ns, excluded.file_size
                )
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
                    file_stat[0] if file_stat else None,
                    file_stat[1] if file_stat else None,
                ),
            )

    def project_task_delete(self, task_id: str) -> None:
        """Removes a task from the SQLite read-model index."""
        with _sqlite_write_lock:
            cursor = self.conn.cursor()
            cursor.execute("DELETE FROM tasks WHERE id = ?", (task_id,))
