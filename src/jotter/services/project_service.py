import json
import shutil
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from jotter.db import get_db
from jotter.models.project import ProjectCreate, ProjectResponse, ProjectUpdate
from jotter.utils.slug import slugify


def get_all_projects(data_dir: str) -> list[ProjectResponse]:
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT id, title, created_at, done_clean_period, git_remote FROM projects ORDER BY created_at ASC")
    rows = cursor.fetchall()
    return [
        ProjectResponse(
            id=row["id"],
            title=row["title"],
            created_at=row["created_at"],
            done_clean_period=row["done_clean_period"],
            git_remote=row["git_remote"],
        )
        for row in rows
    ]


def project_exists(project_id: str) -> bool:
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT 1 FROM projects WHERE id = ?", (project_id,))
    return cursor.fetchone() is not None


def create_project(data_dir: str, req: ProjectCreate, default_buckets: list[dict[str, Any]]) -> ProjectResponse:
    title = req.title.strip()
    if not title:
        raise ValueError("Project title cannot be empty")

    base_id = slugify(title)
    if not base_id:
        base_id = "project"

    conn = get_db()
    cursor = conn.cursor()

    # Generate unique ID
    project_id = base_id
    counter = 1
    while True:
        cursor.execute("SELECT 1 FROM projects WHERE id = ?", (project_id,))
        if not cursor.fetchone():
            break
        project_id = f"{base_id}-{counter}"
        counter += 1

    now_str = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")

    # 1. Update DB (atomic transaction)
    cursor.execute(
        "INSERT INTO projects (id, title, created_at, done_clean_period, git_remote) VALUES (?, ?, ?, ?, ?)",
        (project_id, title, now_str, req.done_clean_period, req.git_remote),
    )

    for b in default_buckets:
        cursor.execute(
            """
            INSERT INTO buckets (project_id, name, title, subtitle, position, color, layout, max_tasks, is_default)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                project_id,
                b["name"],
                b["title"],
                b.get("subtitle", ""),
                float(b["position"]),
                b.get("color"),
                b.get("layout", "list"),
                b.get("max_tasks"),
                1 if b.get("is_default") else 0,
            ),
        )

    # 2. Update filesystem
    projects = load_projects_file(data_dir)
    projects.append(
        {
            "id": project_id,
            "title": title,
            "created_at": now_str,
            "done_clean_period": req.done_clean_period,
            "git_remote": req.git_remote,
        }
    )
    write_projects_file(data_dir, projects)

    # Ensure project directory and default buckets.json
    project_dir = Path(data_dir) / project_id
    project_dir.mkdir(parents=True, exist_ok=True)

    from jotter.services.bucket_service import write_buckets_file

    write_buckets_file(data_dir, project_id, default_buckets)

    return ProjectResponse(
        id=project_id,
        title=title,
        created_at=now_str,
        done_clean_period=req.done_clean_period,
        git_remote=req.git_remote,
    )


def update_project(data_dir: str, project_id: str, req: ProjectUpdate) -> ProjectResponse:
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute(
        "SELECT id, title, created_at, done_clean_period, git_remote FROM projects WHERE id = ?", (project_id,)
    )
    row = cursor.fetchone()
    if not row:
        raise KeyError(f"Project '{project_id}' not found")

    new_title = req.title.strip() if req.title is not None else row["title"]
    new_clean_period = req.done_clean_period if req.done_clean_period is not None else row["done_clean_period"]
    new_git_remote = req.git_remote if req.git_remote is not None else row["git_remote"]

    cursor.execute(
        "UPDATE projects SET title = ?, done_clean_period = ?, git_remote = ? WHERE id = ?",
        (new_title, new_clean_period, new_git_remote, project_id),
    )

    projects = load_projects_file(data_dir)
    for p in projects:
        if p["id"] == project_id:
            p["title"] = new_title
            p["done_clean_period"] = new_clean_period
            p["git_remote"] = new_git_remote
            break
    write_projects_file(data_dir, projects)

    return ProjectResponse(
        id=project_id,
        title=new_title,
        created_at=row["created_at"],
        done_clean_period=new_clean_period,
        git_remote=new_git_remote,
    )


def delete_project(data_dir: str, project_id: str) -> None:
    if project_id == "default":
        raise ValueError("Cannot delete the default project")

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT 1 FROM projects WHERE id = ?", (project_id,))
    if not cursor.fetchone():
        raise KeyError(f"Project '{project_id}' not found")

    # DB deletion cascades to buckets and tasks
    cursor.execute("DELETE FROM projects WHERE id = ?", (project_id,))

    # Update projects.json
    projects = load_projects_file(data_dir)
    projects = [p for p in projects if p["id"] != project_id]
    write_projects_file(data_dir, projects)

    # Delete project directory
    project_dir = Path(data_dir) / project_id
    if project_dir.is_dir():
        shutil.rmtree(project_dir, ignore_errors=True)


def load_projects_file(data_dir: str) -> list[dict[str, Any]]:
    path = Path(data_dir) / "projects.json"
    if not path.is_file():
        now_str = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
        default_proj = [
            {
                "id": "default",
                "title": "Default Project",
                "created_at": now_str,
                "done_clean_period": None,
                "git_remote": None,
            }
        ]
        (Path(data_dir) / "default").mkdir(parents=True, exist_ok=True)
        write_projects_file(data_dir, default_proj)
        return default_proj

    try:
        with open(path, encoding="utf-8") as f:
            projects = json.load(f)
            if not isinstance(projects, list):
                return []
            for p in projects:
                p.setdefault("done_clean_period", None)
                p.setdefault("git_remote", None)
            return projects
    except Exception:
        return []


def write_projects_file(data_dir: str, projects: list[dict[str, Any]]) -> None:
    path = Path(data_dir) / "projects.json"
    parent = path.parent
    parent.mkdir(parents=True, exist_ok=True)

    data = json.dumps(projects, indent=2)
    # Atomic write
    with tempfile.NamedTemporaryFile("w", dir=parent, delete=False, encoding="utf-8") as tf:
        tf.write(data)
        temp_name = tf.name

    Path(temp_name).replace(path)
