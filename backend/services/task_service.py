import json
import shutil
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, BinaryIO

import yaml

from backend.db import get_db
from backend.models.task import TaskCreate, TaskFrontmatter, TaskMove, TaskResponse, TaskUpdate
from backend.utils.ulid import generate_ulid


def parse_frontmatter(content: str) -> tuple[TaskFrontmatter, str]:
    lines = content.split("\n")
    if len(lines) < 2 or lines[0].strip() != "---":
        raise ValueError("Invalid frontmatter: missing start separator '---'")

    yaml_end = -1
    for i in range(1, len(lines)):
        if lines[i].strip() == "---":
            yaml_end = i
            break

    if yaml_end == -1:
        raise ValueError("Invalid frontmatter: missing end separator '---'")

    yaml_block = "\n".join(lines[1:yaml_end])
    body = "\n".join(lines[yaml_end + 1 :])

    data = yaml.safe_load(yaml_block) or {}
    raw_tags = data.get("tags")
    tags = [str(t).lower() for t in raw_tags if t is not None] if isinstance(raw_tags, list) else []

    raw_attachments = data.get("attachments")
    attachments = (
        [str(a) for a in raw_attachments if a is not None]
        if isinstance(raw_attachments, list)
        else []
    )

    fm = TaskFrontmatter(
        id=str(data.get("id", "")),
        project_id=str(data.get("project_id", "default")),
        title=str(data.get("title", "")),
        bucket=str(data.get("bucket", "backlog")),
        position=float(data.get("position", 1000.0)),
        tags=tags,
        attachments=attachments,
        due_date=data.get("due_date"),
        planned_date=data.get("planned_date"),
        priority=data.get("priority"),
        color=data.get("color"),
        postponed_until=data.get("postponed_until"),
        created_at=str(data.get("created_at", "")),
        updated_at=str(data.get("updated_at", "")),
    )
    return fm, body


def dump_frontmatter(fm: TaskFrontmatter, body: str) -> str:
    data: dict[str, Any] = {
        "id": fm.id,
        "project_id": fm.project_id,
        "title": fm.title,
        "bucket": fm.bucket,
        "position": fm.position,
        "tags": fm.tags,
    }
    if fm.attachments:
        data["attachments"] = fm.attachments
    if fm.due_date:
        data["due_date"] = fm.due_date
    if fm.planned_date:
        data["planned_date"] = fm.planned_date
    if fm.priority:
        data["priority"] = fm.priority
    if fm.color:
        data["color"] = fm.color
    if fm.postponed_until:
        data["postponed_until"] = fm.postponed_until
    data["created_at"] = fm.created_at
    data["updated_at"] = fm.updated_at

    yaml_str = yaml.dump(data, sort_keys=False, allow_unicode=True)
    return f"---\n{yaml_str}---\n{body}"


def get_task_file_path(data_dir: str, task_id: str) -> tuple[Path, str, str]:
    tasks_path = Path(data_dir)
    target_filename = f"{task_id}.md"

    # Search in all project subdirectories
    if tasks_path.is_dir():
        for entry in tasks_path.iterdir():
            if entry.is_dir() and not entry.name.startswith("."):
                candidate = entry / target_filename
                if candidate.is_file():
                    return candidate, target_filename, entry.name
                # Case-insensitive check
                for file_entry in entry.iterdir():
                    if file_entry.is_file() and file_entry.name.lower() == target_filename.lower():
                        return file_entry, file_entry.name, entry.name

    raise FileNotFoundError(f"Task file for ID '{task_id}' not found")


def read_task_file(data_dir: str, task_id: str) -> TaskResponse:
    file_path, _, project_id = get_task_file_path(data_dir, task_id)
    content = file_path.read_text(encoding="utf-8")
    fm, body = parse_frontmatter(content)
    return TaskResponse(
        id=task_id,
        project_id=project_id,
        title=fm.title,
        bucket=fm.bucket,
        position=fm.position,
        tags=fm.tags,
        attachments=fm.attachments or [],
        body=body,
        due_date=fm.due_date,
        planned_date=fm.planned_date,
        priority=fm.priority,
        color=fm.color,
        postponed_until=fm.postponed_until,
        created_at=fm.created_at,
        updated_at=fm.updated_at,
    )


def write_task_file(data_dir: str, task_id: str, fm: TaskFrontmatter, body: str) -> tuple[Path, str]:
    project_dir = Path(data_dir) / fm.project_id
    project_dir.mkdir(parents=True, exist_ok=True)

    filename = f"{task_id}.md"
    target_file = project_dir / filename
    content = dump_frontmatter(fm, body)

    # Check if existing task is in a different project directory
    old_file: Path | None = None
    old_project_id: str | None = None
    try:
        old_file, _, old_project_id = get_task_file_path(data_dir, task_id)
    except FileNotFoundError:
        pass

    # Atomic write
    with tempfile.NamedTemporaryFile("w", dir=project_dir, delete=False, encoding="utf-8") as tf:
        tf.write(content)
        temp_name = tf.name

    Path(temp_name).replace(target_file)

    # Move attachments directory if project changed
    if old_file and old_project_id and old_project_id != fm.project_id:
        old_att = Path(data_dir) / old_project_id / f"{task_id}.attachments"
        new_att = Path(data_dir) / fm.project_id / f"{task_id}.attachments"
        if old_att.is_dir():
            if new_att.exists():
                shutil.rmtree(new_att, ignore_errors=True)
            shutil.move(str(old_att), str(new_att))
        if old_file.is_file() and old_file.resolve() != target_file.resolve():
            old_file.unlink(missing_ok=True)

    return target_file, filename


def delete_task_file(data_dir: str, task_id: str) -> bool:
    try:
        file_path, _, project_id = get_task_file_path(data_dir, task_id)
        file_path.unlink(missing_ok=True)
        att_dir = Path(data_dir) / project_id / f"{task_id}.attachments"
        if att_dir.is_dir():
            shutil.rmtree(att_dir, ignore_errors=True)
        return True
    except FileNotFoundError:
        return False


def get_tasks(
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
) -> list[TaskResponse]:
    conn = get_db()
    cursor = conn.cursor()

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

    # Bucket filtering
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
        clauses = []
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
        # Exclude postponed if requested
        exclude_postponed = False
        if exclude_bucket == "postponed":
            exclude_postponed = True
        if exclude_buckets and "postponed" in exclude_buckets:
            exclude_postponed = True

        if exclude_postponed:
            query += " AND (postponed_until IS NULL OR postponed_until = '' OR postponed_until <= ?)"
            args.append(today_str)

    if exclude_bucket and exclude_bucket != "postponed":
        query += " AND bucket != ?"
        args.append(exclude_bucket)

    if exclude_buckets:
        valid_excludes = [b.strip() for b in exclude_buckets if b.strip() and b.strip() != "postponed"]
        if valid_excludes:
            placeholders = ",".join("?" * len(valid_excludes))
            query += f" AND bucket NOT IN ({placeholders})"
            args.extend(valid_excludes)

    if priorities:
        include_none = "none" in priorities or "" in priorities
        active_priorities = [p.strip() for p in priorities if p.strip() and p.strip() != "none"]
        sub_conditions = []
        if include_none:
            sub_conditions.append("(priority IS NULL OR priority = '')")
        if active_priorities:
            placeholders = ",".join("?" * len(active_priorities))
            sub_conditions.append(f"priority IN ({placeholders})")
            args.extend(active_priorities)
        if sub_conditions:
            query += f" AND ({' OR '.join(sub_conditions)})"

    if due_before:
        query += " AND due_date IS NOT NULL AND due_date <= ?"
        args.append(due_before)

    if due_after:
        query += " AND due_date IS NOT NULL AND due_date >= ?"
        args.append(due_after)

    if planned_date:
        query += " AND planned_date = ?"
        args.append(planned_date)

    if has_due_date is not None:
        if has_due_date:
            query += " AND due_date IS NOT NULL AND due_date != ''"
        else:
            query += " AND (due_date IS NULL OR due_date = '')"

    if project_id:
        query += " ORDER BY position ASC"
    else:
        query += " ORDER BY created_at DESC"

    cursor.execute(query, tuple(args))
    rows = cursor.fetchall()

    tasks_list: list[TaskResponse] = []
    # Combine tag filters
    effective_tags = list(tags) if tags else ([tag] if tag else [])

    for r in rows:
        tags_raw = json.loads(r["tags"]) if r["tags"] else []
        if not isinstance(tags_raw, list):
            tags_raw = []

        att_raw = json.loads(r["attachments"]) if r["attachments"] else []
        if not isinstance(att_raw, list):
            att_raw = []

        # In-memory Tag & Search filtering for maximum precision
        if effective_tags:
            task_tags_lower = [t.lower() for t in tags_raw]
            filter_tags_lower = [t.lower() for t in effective_tags]
            if tag_mode == "all":
                if not all(ft in task_tags_lower for ft in filter_tags_lower):
                    continue
            else:  # any
                if not any(ft in task_tags_lower for ft in filter_tags_lower):
                    continue

        if search:
            search_lower = search.lower()
            title_match = search_lower in (r["title"] or "").lower()
            body_match = search_lower in (r["body"] or "").lower()
            tag_match = any(search_lower in t.lower() for t in tags_raw)
            if not (title_match or body_match or tag_match):
                continue

        tasks_list.append(
            TaskResponse(
                id=r["id"],
                project_id=r["project_id"],
                title=r["title"],
                bucket=r["bucket"],
                position=float(r["position"]),
                tags=tags_raw,
                attachments=att_raw,
                body=r["body"] or "",
                due_date=r["due_date"],
                planned_date=r["planned_date"],
                priority=r["priority"],
                color=r["color"],
                postponed_until=r["postponed_until"],
                created_at=r["created_at"],
                updated_at=r["updated_at"],
            )
        )

    return tasks_list


def create_task(data_dir: str, project_id: str, req: TaskCreate) -> TaskResponse:
    from backend.services.project_service import project_exists

    if not project_exists(project_id):
        raise KeyError(f"Project '{project_id}' not found")

    new_id = generate_ulid()
    now_str = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")

    conn = get_db()
    cursor = conn.cursor()

    # Calculate max position
    cursor.execute(
        "SELECT MAX(position) as max_pos FROM tasks WHERE project_id = ? AND bucket = ?", (project_id, req.bucket)
    )
    row = cursor.fetchone()
    position = (row["max_pos"] + 1000.0) if row and row["max_pos"] is not None else 1000.0

    normalized_tags = [t.strip().lower() for t in req.tags if t.strip()]

    fm = TaskFrontmatter(
        id=new_id,
        project_id=project_id,
        title=req.title,
        bucket=req.bucket,
        position=position,
        tags=normalized_tags,
        attachments=[],
        due_date=req.due_date,
        planned_date=req.planned_date,
        priority=req.priority,
        color=req.color,
        postponed_until=req.postponed_until,
        created_at=now_str,
        updated_at=now_str,
    )

    # 1. Write Markdown file
    _, filename = write_task_file(data_dir, new_id, fm, req.body)

    # 2. Insert into SQLite index
    cursor.execute(
        """
        INSERT INTO tasks (
            id, project_id, title, bucket, position, tags, attachments, filename, body,
            due_date, planned_date, priority, color, postponed_until, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            new_id,
            project_id,
            req.title,
            req.bucket,
            position,
            json.dumps(normalized_tags),
            json.dumps([]),
            filename,
            req.body,
            req.due_date,
            req.planned_date,
            req.priority,
            req.color,
            req.postponed_until,
            now_str,
            now_str,
        ),
    )

    return TaskResponse(
        id=new_id,
        project_id=project_id,
        title=req.title,
        bucket=req.bucket,
        position=position,
        tags=normalized_tags,
        attachments=[],
        body=req.body,
        due_date=req.due_date,
        planned_date=req.planned_date,
        priority=req.priority,
        color=req.color,
        postponed_until=req.postponed_until,
        created_at=now_str,
        updated_at=now_str,
    )


def update_task(data_dir: str, project_id: str, task_id: str, req: TaskUpdate) -> TaskResponse:
    current = read_task_file(data_dir, task_id)
    now_str = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")

    target_project_id = req.project_id if req.project_id is not None else current.project_id
    new_title = req.title if req.title is not None else current.title
    new_bucket = req.bucket if req.bucket is not None else current.bucket
    new_position = req.position if req.position is not None else current.position
    new_tags = [t.lower() for t in req.tags] if req.tags is not None else current.tags
    new_attachments = req.attachments if req.attachments is not None else current.attachments
    new_body = req.body if req.body is not None else current.body
    new_due_date = req.due_date if req.due_date is not None else current.due_date
    new_planned_date = req.planned_date if req.planned_date is not None else current.planned_date
    new_priority = req.priority if req.priority is not None else current.priority
    new_color = req.color if req.color is not None else current.color
    new_postponed = req.postponed_until if req.postponed_until is not None else current.postponed_until

    fm = TaskFrontmatter(
        id=task_id,
        project_id=target_project_id,
        title=new_title,
        bucket=new_bucket,
        position=new_position,
        tags=new_tags,
        attachments=new_attachments,
        due_date=new_due_date,
        planned_date=new_planned_date,
        priority=new_priority,
        color=new_color,
        postponed_until=new_postponed,
        created_at=current.created_at,
        updated_at=now_str,
    )

    _, filename = write_task_file(data_dir, task_id, fm, new_body)

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute(
        """
        UPDATE tasks SET
            project_id = ?, title = ?, bucket = ?, position = ?, tags = ?, attachments = ?,
            filename = ?, body = ?, due_date = ?, planned_date = ?, priority = ?, color = ?,
            postponed_until = ?, updated_at = ?
        WHERE id = ?
        """,
        (
            target_project_id,
            new_title,
            new_bucket,
            new_position,
            json.dumps(new_tags),
            json.dumps(new_attachments),
            filename,
            new_body,
            new_due_date,
            new_planned_date,
            new_priority,
            new_color,
            new_postponed,
            now_str,
            task_id,
        ),
    )

    return TaskResponse(
        id=task_id,
        project_id=target_project_id,
        title=new_title,
        bucket=new_bucket,
        position=new_position,
        tags=new_tags,
        attachments=new_attachments,
        body=new_body,
        due_date=new_due_date,
        planned_date=new_planned_date,
        priority=new_priority,
        color=new_color,
        postponed_until=new_postponed,
        created_at=current.created_at,
        updated_at=now_str,
    )


def move_task(data_dir: str, project_id: str, task_id: str, req: TaskMove) -> TaskResponse:
    update_req = TaskUpdate(bucket=req.bucket, position=req.position)
    return update_task(data_dir, project_id, task_id, update_req)


def delete_task(data_dir: str, project_id: str, task_id: str) -> None:
    delete_task_file(data_dir, task_id)
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM tasks WHERE id = ?", (task_id,))


def save_attachment(data_dir: str, project_id: str, task_id: str, filename: str, file_obj: BinaryIO) -> TaskResponse:
    current = read_task_file(data_dir, task_id)
    attachments_dir = Path(data_dir) / project_id / f"{task_id}.attachments"
    attachments_dir.mkdir(parents=True, exist_ok=True)

    dest_path = attachments_dir / filename
    with open(dest_path, "wb") as f:
        shutil.copyfileobj(file_obj, f)

    att_list = list(current.attachments)
    if filename not in att_list:
        att_list.append(filename)

    update_req = TaskUpdate(attachments=att_list)
    return update_task(data_dir, project_id, task_id, update_req)


def delete_attachment(data_dir: str, project_id: str, task_id: str, filename: str) -> TaskResponse:
    current = read_task_file(data_dir, task_id)
    file_path = Path(data_dir) / project_id / f"{task_id}.attachments" / filename
    if file_path.is_file():
        file_path.unlink()

    att_list = [a for a in current.attachments if a != filename]
    update_req = TaskUpdate(attachments=att_list)
    return update_task(data_dir, project_id, task_id, update_req)


def get_attachment_path(data_dir: str, project_id: str, task_id: str, filename: str) -> Path:
    return Path(data_dir) / project_id / f"{task_id}.attachments" / filename
