import json
import logging
import os
import re
import shutil
import tempfile
import unicodedata
from datetime import datetime, timezone
from typing import Any, Dict, Optional, Tuple

import frontmatter

from config import IS_PRODUCTION, get_data_dir
from database import db_session

logger = logging.getLogger("jotter.storage")

data_dir = get_data_dir()
if data_dir:
    TASKS_DIR = os.path.abspath(data_dir)
elif IS_PRODUCTION:
    TASKS_DIR = os.path.abspath(os.path.join(os.getcwd(), "tasks"))
else:
    TASKS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "tasks")

# Ensure the tasks directory exists
os.makedirs(TASKS_DIR, exist_ok=True)

# Kept for compatibility/imports
BUCKETS_FILE = os.path.join(TASKS_DIR, "buckets.json")
PROJECTS_FILE = os.path.join(TASKS_DIR, "projects.json")

DEFAULT_BUCKETS = [
    {"name": "backlog", "title": "Backlog", "subtitle": "", "position": 1000.0},
    {"name": "todo", "title": "To Do", "subtitle": "", "position": 2000.0},
    {"name": "in-progress", "title": "In Progress", "subtitle": "", "position": 3000.0},
    {"name": "done", "title": "Done", "subtitle": "", "position": 4000.0},
]


def migrate_legacy_layout():
    """Migrates a single-project flat layout to multi-project directory layout."""
    default_dir = os.path.join(TASKS_DIR, "default")

    # Check if there are any flat task files or a buckets.json directly in TASKS_DIR
    legacy_files = []
    has_legacy_buckets = os.path.exists(os.path.join(TASKS_DIR, "buckets.json"))

    for filename in os.listdir(TASKS_DIR):
        filepath = os.path.join(TASKS_DIR, filename)
        if os.path.isfile(filepath):
            if filename.endswith(".md") and filename.split("-", 1)[0].isdigit():
                legacy_files.append(filename)

    if has_legacy_buckets or legacy_files:
        os.makedirs(default_dir, exist_ok=True)
        # Move buckets.json
        if has_legacy_buckets:
            try:
                os.replace(
                    os.path.join(TASKS_DIR, "buckets.json"),
                    os.path.join(default_dir, "buckets.json"),
                )
            except Exception as e:
                logger.error(f"Error migrating buckets.json: {e}")
        # Move task files
        for filename in legacy_files:
            try:
                os.replace(
                    os.path.join(TASKS_DIR, filename),
                    os.path.join(default_dir, filename),
                )
            except Exception as e:
                logger.error(f"Error migrating task file {filename}: {e}")

        # Initialize projects.json if not present
        if not os.path.exists(PROJECTS_FILE):
            now_str = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
            default_project = [
                {
                    "id": "default",
                    "title": "Default Project",
                    "created_at": now_str,
                }
            ]
            with open(PROJECTS_FILE, "w", encoding="utf-8") as f:
                json.dump(default_project, f, indent=2)


def load_projects_file() -> list:
    """Loads projects from the projects.json file. If it doesn't exist, initializes default and returns it."""
    migrate_legacy_layout()
    if not os.path.exists(PROJECTS_FILE):
        now_str = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
        default_project = [
            {
                "id": "default",
                "title": "Default Project",
                "created_at": now_str,
            }
        ]
        os.makedirs(os.path.join(TASKS_DIR, "default"), exist_ok=True)
        write_projects_file(default_project)
        return default_project
    try:
        with open(PROJECTS_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return []


def write_projects_file(projects: list):
    """Writes the list of projects to projects.json atomically."""
    temp_fd, temp_path = tempfile.mkstemp(dir=TASKS_DIR, suffix=".tmp")
    try:
        with os.fdopen(temp_fd, "w", encoding="utf-8") as f:
            json.dump(projects, f, indent=2)
        os.replace(temp_path, PROJECTS_FILE)
    except Exception:
        if os.path.exists(temp_path):
            os.remove(temp_path)
        raise


def delete_project_dir(project_id: str):
    """Deletes a project's directory and all its files from the filesystem."""
    project_dir = os.path.join(TASKS_DIR, project_id)
    if os.path.exists(project_dir) and os.path.isdir(project_dir):
        shutil.rmtree(project_dir)


def load_buckets_file(project_id: str = "default") -> list:
    """Loads buckets for a specific project from tasks/{project_id}/buckets.json."""
    project_dir = os.path.join(TASKS_DIR, project_id)
    os.makedirs(project_dir, exist_ok=True)
    buckets_file = os.path.join(project_dir, "buckets.json")

    if not os.path.exists(buckets_file):
        write_buckets_file(project_id, DEFAULT_BUCKETS)
        return DEFAULT_BUCKETS
    try:
        with open(buckets_file, "r", encoding="utf-8") as f:
            data = json.load(f)
            for item in data:
                if "subtitle" not in item:
                    item["subtitle"] = ""
                if "color" not in item:
                    item["color"] = None
                if "layout" not in item:
                    item["layout"] = "list"
                if "max_tasks" not in item:
                    item["max_tasks"] = None
            return data
    except Exception:
        return DEFAULT_BUCKETS


def write_buckets_file(project_id: str = "default", buckets: list = None):
    """Writes the list of buckets to buckets.json atomically for the project."""
    if buckets is None:
        buckets = DEFAULT_BUCKETS

    project_dir = os.path.join(TASKS_DIR, project_id)
    os.makedirs(project_dir, exist_ok=True)
    buckets_file = os.path.join(project_dir, "buckets.json")

    temp_fd, temp_path = tempfile.mkstemp(dir=project_dir, suffix=".tmp")
    try:
        with os.fdopen(temp_fd, "w", encoding="utf-8") as f:
            json.dump(buckets, f, indent=2)
        os.replace(temp_path, buckets_file)
    except Exception:
        if os.path.exists(temp_path):
            os.remove(temp_path)
        raise


def slugify(value: str) -> str:
    """Converts a string to a URL-friendly slug."""
    value = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode("ascii")
    value = re.sub(r"[^\w\s-]", "", value.lower())
    return re.sub(r"[-\s]+", "-", value).strip("-_")


def get_task_file_path(task_id: int) -> Tuple[Optional[str], Optional[str], Optional[str]]:
    """
    Finds the file path and project ID for a task ID by scanning directories.
    Supports both 6-digit zero-padded prefixes and legacy numeric prefixes.
    Returns (absolute_file_path, filename, project_id) if found, else (None, None, None).
    """
    prefix_padded = f"{task_id:06d}-"
    prefix_legacy = f"{task_id}-"
    if not os.path.exists(TASKS_DIR):
        return None, None, None

    def search_in_dir(directory: str) -> Tuple[Optional[str], Optional[str]]:
        for filename in os.listdir(directory):
            if filename.endswith(".md"):
                if filename.startswith(prefix_padded) or filename.startswith(prefix_legacy):
                    return os.path.join(directory, filename), filename
        return None, None

    # Check root TASKS_DIR first (for testing/legacy)
    filepath, filename = search_in_dir(TASKS_DIR)
    if filepath:
        return filepath, filename, "default"

    # Check subdirectories
    for item in os.listdir(TASKS_DIR):
        project_dir = os.path.join(TASKS_DIR, item)
        if os.path.isdir(project_dir) and not item.startswith("."):
            filepath, filename = search_in_dir(project_dir)
            if filepath:
                return filepath, filename, item

    return None, None, None


def generate_next_id() -> int:
    """Finds the maximum task ID from all project files and returns max + 1 (starts at 1)."""
    max_id = 0
    if not os.path.exists(TASKS_DIR):
        return max_id + 1

    # Check flat root directory
    for filename in os.listdir(TASKS_DIR):
        filepath = os.path.join(TASKS_DIR, filename)
        if os.path.isfile(filepath) and filename.endswith(".md"):
            parts = filename.split("-", 1)
            if parts[0].isdigit():
                max_id = max(max_id, int(parts[0]))

    # Check subdirectories
    for item in os.listdir(TASKS_DIR):
        project_dir = os.path.join(TASKS_DIR, item)
        if os.path.isdir(project_dir) and not item.startswith("."):
            for filename in os.listdir(project_dir):
                if filename.endswith(".md"):
                    parts = filename.split("-", 1)
                    if parts[0].isdigit():
                        max_id = max(max_id, int(parts[0]))

    return max_id + 1


def read_task_file(task_id: int) -> Optional[Dict[str, Any]]:
    """Reads a task file and returns a dictionary of its metadata and body."""
    file_path, _, project_id = get_task_file_path(task_id)
    if not file_path or not os.path.exists(file_path):
        return None

    post = frontmatter.load(file_path)
    metadata = post.metadata

    return {
        "id": task_id,
        "project_id": project_id or "default",
        "title": metadata.get("title", ""),
        "bucket": metadata.get("bucket", "todo"),
        "position": float(metadata.get("position", 1000.0)),
        "tags": [t.lower() for t in metadata.get("tags", [])],
        "due_date": metadata.get("due_date", None),
        "priority": metadata.get("priority", None),
        "body": post.content,
        "created_at": metadata.get("created_at", ""),
        "updated_at": metadata.get("updated_at", ""),
    }


def write_task_file(task_id: int, task_data: Dict[str, Any]) -> str:
    """
    Writes a task file atomically using a temporary file.
    If the title or project changes, deletes the old file.
    Returns the new filename.
    """
    project_id = task_data.get("project_id", "default")
    project_dir = os.path.join(TASKS_DIR, project_id)
    os.makedirs(project_dir, exist_ok=True)

    slug = slugify(task_data["title"])
    new_filename = f"{task_id:06d}-{slug}.md"
    new_filepath = os.path.join(project_dir, new_filename)

    old_filepath, old_filename, old_project_id = get_task_file_path(task_id)

    # Prepare the frontmatter post
    post = frontmatter.Post(
        task_data["body"],
        id=task_id,
        project_id=project_id,
        title=task_data["title"],
        bucket=task_data["bucket"],
        position=task_data["position"],
        tags=[t.lower() for t in task_data["tags"]],
        due_date=task_data.get("due_date", None),
        priority=task_data.get("priority", None),
        created_at=task_data["created_at"],
        updated_at=task_data["updated_at"],
    )

    # Atomic write: write to a temp file in the same directory, then rename
    temp_fd, temp_path = tempfile.mkstemp(dir=project_dir, suffix=".tmp")
    try:
        with os.fdopen(temp_fd, "w", encoding="utf-8") as f:
            frontmatter.dump(post, f)

        # Rename temp file to target path
        os.replace(temp_path, new_filepath)
    except Exception:
        if os.path.exists(temp_path):
            os.remove(temp_path)
        raise

    # If the filename or project directory changed, delete the old file
    if old_filepath and old_filepath != new_filepath:
        if os.path.exists(old_filepath):
            os.remove(old_filepath)

    return new_filename


def delete_task_file(task_id: int) -> bool:
    """Deletes a task file. Returns True if deleted, False otherwise."""
    file_path, _, _ = get_task_file_path(task_id)
    if file_path and os.path.exists(file_path):
        os.remove(file_path)
        return True
    return False


def sync_db_with_files() -> int:
    """
    Clears the SQLite tasks, buckets, and projects tables, and rebuilds them.
    Loads projects from projects.json, buckets from tasks/{project_id}/buckets.json,
    and tasks from all markdown files in tasks/{project_id}/.
    Auto-creates missing buckets referenced by task markdown files.
    Returns the count of successfully synchronized tasks.
    """
    # First, run the migration to move flat files if any exist
    migrate_legacy_layout()

    count = 0
    with db_session() as conn:
        # Clear existing tables data
        conn.execute("DELETE FROM tasks")
        conn.execute("DELETE FROM buckets")
        conn.execute("DELETE FROM projects")

        # Load projects registry
        projects = load_projects_file()
        for p in projects:
            conn.execute(
                "INSERT INTO projects (id, title, created_at) VALUES (?, ?, ?)",
                (p["id"], p["title"], p["created_at"]),
            )

            # Sync buckets for this project
            buckets = load_buckets_file(p["id"])
            bucket_names = set()
            max_bucket_position = 0.0

            for b in buckets:
                conn.execute(
                    """
                    INSERT INTO buckets
                    (project_id, name, title, subtitle, position, color, layout, max_tasks)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (p["id"], b["name"], b["title"], b.get("subtitle", ""), b["position"], b.get("color", None), b.get("layout", "list"), b.get("max_tasks", None)),
                )
                bucket_names.add(b["name"])
                max_bucket_position = max(max_bucket_position, b["position"])

            project_dir = os.path.join(TASKS_DIR, p["id"])
            buckets_modified = False

            if os.path.exists(project_dir) and os.path.isdir(project_dir):
                for filename in os.listdir(project_dir):
                    if filename.endswith(".md"):
                        parts = filename.split("-", 1)
                        if not parts[0].isdigit():
                            continue
                        task_id = int(parts[0])

                        filepath = os.path.join(project_dir, filename)
                        try:
                            post = frontmatter.load(filepath)
                            metadata = post.metadata

                            id_val = int(metadata.get("id", task_id))
                            title = metadata.get("title", filename[:-3])
                            bucket = metadata.get("bucket", "todo")
                            position = float(metadata.get("position", 1000.0))
                            tags = [t.lower() for t in metadata.get("tags", [])]
                            due_date = metadata.get("due_date", None)
                            priority = metadata.get("priority", None)
                            created_at = metadata.get("created_at", "")
                            updated_at = metadata.get("updated_at", "")

                            # Auto-create column if it doesn't exist in the project
                            if bucket not in bucket_names:
                                new_title = bucket.replace("-", " ").title()
                                new_pos = max_bucket_position + 1000.0
                                conn.execute(
                                    """
                                    INSERT INTO buckets
                                    (project_id, name, title, subtitle, position, color, layout, max_tasks)
                                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                                    """,
                                    (p["id"], bucket, new_title, "", new_pos, None, "list", None),
                                )
                                buckets.append(
                                    {
                                        "name": bucket,
                                        "title": new_title,
                                        "subtitle": "",
                                        "position": new_pos,
                                        "color": None,
                                        "layout": "list",
                                        "max_tasks": None,
                                    }
                                )
                                bucket_names.add(bucket)
                                max_bucket_position = new_pos
                                buckets_modified = True

                            conn.execute(
                                """
                                INSERT INTO tasks (
                                    id, project_id, title, bucket, position, tags, filename, due_date, priority, created_at, updated_at
                                )
                                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                            """,
                                (
                                    id_val,
                                    p["id"],
                                    title,
                                    bucket,
                                    position,
                                    json.dumps(tags),
                                    filename,
                                    due_date,
                                    priority,
                                    created_at,
                                    updated_at,
                                ),
                            )
                            count += 1
                        except Exception as e:
                            logger.error(f"Error syncing file {filename} in project {p['id']}: {e}")

            if buckets_modified:
                write_buckets_file(p["id"], buckets)

    return count
