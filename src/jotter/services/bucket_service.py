import json
import tempfile
from pathlib import Path
from typing import Any

from jotter.db import get_db
from jotter.models.bucket import BucketCreate, BucketResponse, BucketUpdate
from jotter.utils.slug import slugify

DEFAULT_BUCKETS: list[dict[str, Any]] = [
    {
        "name": "backlog",
        "title": "Backlog",
        "subtitle": "",
        "position": 1000.0,
        "is_default": True,
        "layout": "list",
        "color": None,
        "max_tasks": None,
    },
    {
        "name": "todo",
        "title": "To Do",
        "subtitle": "",
        "position": 2000.0,
        "is_default": False,
        "layout": "list",
        "color": None,
        "max_tasks": None,
    },
    {
        "name": "in-progress",
        "title": "In Progress",
        "subtitle": "",
        "position": 3000.0,
        "is_default": False,
        "layout": "list",
        "color": None,
        "max_tasks": None,
    },
    {
        "name": "done",
        "title": "Done",
        "subtitle": "",
        "position": 4000.0,
        "is_default": False,
        "layout": "list",
        "color": None,
        "max_tasks": None,
    },
    {
        "name": "archive",
        "title": "Archive",
        "subtitle": "",
        "position": 5000.0,
        "is_default": False,
        "layout": "list",
        "color": None,
        "max_tasks": None,
    },
]


def get_all_buckets(project_id: str) -> list[BucketResponse]:
    conn = get_db()
    cursor = conn.cursor()
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
    return [
        BucketResponse(
            name=row["name"],
            title=row["title"],
            subtitle=row["subtitle"] or "",
            position=float(row["position"]),
            color=row["color"],
            layout=row["layout"] or "list",
            max_tasks=row["max_tasks"],
            is_default=bool(row["is_default"]),
        )
        for row in rows
    ]


def get_bucket(project_id: str, name: str) -> BucketResponse | None:
    conn = get_db()
    cursor = conn.cursor()
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
        return None
    return BucketResponse(
        name=row["name"],
        title=row["title"],
        subtitle=row["subtitle"] or "",
        position=float(row["position"]),
        color=row["color"],
        layout=row["layout"] or "list",
        max_tasks=row["max_tasks"],
        is_default=bool(row["is_default"]),
    )


def create_bucket(data_dir: str, project_id: str, req: BucketCreate) -> BucketResponse:
    title = req.title.strip()
    if not title:
        raise ValueError("Column title cannot be empty")

    base_name = slugify(title)
    if not base_name:
        base_name = "column"

    conn = get_db()
    cursor = conn.cursor()

    # Generate unique bucket name within project
    bucket_name = base_name
    counter = 1
    while True:
        cursor.execute("SELECT 1 FROM buckets WHERE project_id = ? AND name = ?", (project_id, bucket_name))
        if not cursor.fetchone():
            break
        bucket_name = f"{base_name}-{counter}"
        counter += 1

    # Position: max(position) + 1000
    cursor.execute("SELECT MAX(position) as max_pos FROM buckets WHERE project_id = ?", (project_id,))
    row = cursor.fetchone()
    position = (row["max_pos"] + 1000.0) if row and row["max_pos"] is not None else 1000.0

    is_default = bool(req.is_default)
    if is_default:
        cursor.execute("UPDATE buckets SET is_default = 0 WHERE project_id = ?", (project_id,))

    cursor.execute(
        """
        INSERT INTO buckets (project_id, name, title, subtitle, position, color, layout, max_tasks, is_default)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            project_id,
            bucket_name,
            title,
            req.subtitle or "",
            position,
            req.color,
            req.layout or "list",
            req.max_tasks,
            1 if is_default else 0,
        ),
    )

    sync_buckets_file(data_dir, project_id)

    return BucketResponse(
        name=bucket_name,
        title=title,
        subtitle=req.subtitle or "",
        position=position,
        color=req.color,
        layout=req.layout or "list",
        max_tasks=req.max_tasks,
        is_default=is_default,
    )


def update_bucket(data_dir: str, project_id: str, name: str, req: BucketUpdate) -> BucketResponse:
    current = get_bucket(project_id, name)
    if not current:
        raise KeyError(f"Column '{name}' not found in project '{project_id}'")

    new_title = req.title.strip() if req.title is not None else current.title
    new_subtitle = req.subtitle if req.subtitle is not None else current.subtitle
    new_pos = req.position if req.position is not None else current.position
    new_color = req.color if req.color is not None else current.color
    new_layout = req.layout if req.layout is not None else current.layout
    new_max_tasks = req.max_tasks if req.max_tasks is not None else current.max_tasks
    new_is_default = req.is_default if req.is_default is not None else current.is_default

    conn = get_db()
    cursor = conn.cursor()

    if new_is_default:
        cursor.execute("UPDATE buckets SET is_default = 0 WHERE project_id = ?", (project_id,))

    cursor.execute(
        """
        UPDATE buckets
        SET title = ?, subtitle = ?, position = ?, color = ?, layout = ?, max_tasks = ?, is_default = ?
        WHERE project_id = ? AND name = ?
        """,
        (
            new_title,
            new_subtitle,
            new_pos,
            new_color,
            new_layout,
            new_max_tasks,
            1 if new_is_default else 0,
            project_id,
            name,
        ),
    )

    sync_buckets_file(data_dir, project_id)

    return BucketResponse(
        name=name,
        title=new_title,
        subtitle=new_subtitle,
        position=new_pos,
        color=new_color,
        layout=new_layout,
        max_tasks=new_max_tasks,
        is_default=new_is_default,
    )


def delete_bucket(data_dir: str, project_id: str, name: str) -> None:
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT COUNT(*) as cnt FROM tasks WHERE project_id = ? AND bucket = ?", (project_id, name))
    row = cursor.fetchone()
    if row and row["cnt"] > 0:
        raise ValueError(f"Cannot delete column '{name}' because it contains {row['cnt']} task(s)")

    cursor.execute("DELETE FROM buckets WHERE project_id = ? AND name = ?", (project_id, name))
    sync_buckets_file(data_dir, project_id)


def sync_buckets_file(data_dir: str, project_id: str) -> None:
    buckets = get_all_buckets(project_id)
    buckets_data = [b.model_dump() for b in buckets]
    write_buckets_file(data_dir, project_id, buckets_data)


def load_buckets_file(data_dir: str, project_id: str) -> list[dict[str, Any]]:
    project_dir = Path(data_dir) / project_id
    project_dir.mkdir(parents=True, exist_ok=True)
    buckets_file = project_dir / "buckets.json"

    if not buckets_file.is_file():
        write_buckets_file(data_dir, project_id, DEFAULT_BUCKETS)
        return DEFAULT_BUCKETS

    try:
        with open(buckets_file, encoding="utf-8") as f:
            buckets = json.load(f)
            if not isinstance(buckets, list):
                return DEFAULT_BUCKETS
            for b in buckets:
                b.setdefault("subtitle", "")
                b.setdefault("color", None)
                b.setdefault("layout", "list")
                b.setdefault("max_tasks", None)
                b.setdefault("is_default", False)
            return buckets
    except Exception:
        return DEFAULT_BUCKETS


def write_buckets_file(data_dir: str, project_id: str, buckets: list[dict[str, Any]]) -> None:
    project_dir = Path(data_dir) / project_id
    project_dir.mkdir(parents=True, exist_ok=True)
    buckets_file = project_dir / "buckets.json"

    data = json.dumps(buckets, indent=2)
    with tempfile.NamedTemporaryFile("w", dir=project_dir, delete=False, encoding="utf-8") as tf:
        tf.write(data)
        temp_name = tf.name

    Path(temp_name).replace(buckets_file)
