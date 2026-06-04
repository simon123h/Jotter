import json
import logging
import os
import re
import shutil
import tempfile
import time
import unicodedata
from datetime import datetime, timezone
from typing import Any, Dict, Optional, Tuple

import frontmatter

from config import IS_PRODUCTION, get_data_dir
from database import db_session
from db_models import Bucket, Project, Task

ENCODING = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"


def encode_base32(value: int, length: int) -> str:
    chars = []
    for _ in range(length):
        chars.append(ENCODING[value % 32])
        value //= 32
    return "".join(reversed(chars))


def generate_ulid() -> str:
    # 48-bit timestamp in milliseconds
    timestamp = int(time.time() * 1000)
    # 80-bit randomness (10 bytes)
    random_bytes = os.urandom(10)

    # Encode timestamp to 10 chars
    ts_str = encode_base32(timestamp, 10)

    # Encode random bytes (10 bytes = 80 bits = 16 base32 chars)
    rand_val = int.from_bytes(random_bytes, byteorder="big")
    rand_str = encode_base32(rand_val, 16)

    return ts_str + rand_str


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
    {"name": "backlog", "title": "Backlog", "subtitle": "", "position": 1000.0, "is_default": True},
    {"name": "todo", "title": "To Do", "subtitle": "", "position": 2000.0, "is_default": False},
    {"name": "in-progress", "title": "In Progress", "subtitle": "", "position": 3000.0, "is_default": False},
    {"name": "done", "title": "Done", "subtitle": "", "position": 4000.0, "is_default": False},
]


def load_projects_file() -> list:
    """Loads projects from the projects.json file. If it doesn't exist, initializes default and returns it."""

    if not os.path.exists(PROJECTS_FILE):
        now_str = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
        default_project = [
            {
                "id": "default",
                "title": "Default Project",
                "created_at": now_str,
                "done_clean_period": None,
            }
        ]
        os.makedirs(os.path.join(TASKS_DIR, "default"), exist_ok=True)
        write_projects_file(default_project)
        return default_project
    try:
        with open(PROJECTS_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
            for item in data:
                if "done_clean_period" not in item:
                    item["done_clean_period"] = None
            return data
    except Exception as e:
        logger.error(f"Error loading projects registry: {e}")
        return []


def write_projects_file(projects: list):
    """Writes the list of projects to projects.json atomically."""
    temp_fd, temp_path = tempfile.mkstemp(dir=TASKS_DIR, suffix=".tmp")
    try:
        with os.fdopen(temp_fd, "w", encoding="utf-8") as f:
            json.dump(projects, f, indent=2)
        os.replace(temp_path, PROJECTS_FILE)
    except Exception as e:
        logger.error(f"Error writing projects file: {e}")
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
    except Exception as e:
        logger.error(f"Error loading buckets file for project '{project_id}': {e}")
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
    except Exception as e:
        logger.error(f"Error writing buckets file for project '{project_id}': {e}")
        if os.path.exists(temp_path):
            os.remove(temp_path)
        raise


def slugify(value: str) -> str:
    """Converts a string to a URL-friendly slug."""
    value = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode("ascii")
    value = re.sub(r"[^\w\s-]", "", value.lower())
    return re.sub(r"[-\s]+", "-", value).strip("-_")


def get_task_file_path(task_id: str) -> Tuple[Optional[str], Optional[str], Optional[str]]:
    """
    Finds the file path and project ID for a task ID by scanning directories.
    Supports both ULID ({task_id}.md) and legacy numeric prefixes ({padded}-* or {task_id}-*).
    Returns (absolute_file_path, filename, project_id) if found, else (None, None, None).
    """
    ulid_filename = f"{task_id}.md"

    try:
        task_int = int(task_id)
        prefix_padded = f"{task_int:06d}-"
        prefix_legacy = f"{task_int}-"
    except ValueError:
        prefix_padded = None
        prefix_legacy = None

    if not os.path.exists(TASKS_DIR):
        return None, None, None

    def search_in_dir(directory: str) -> Tuple[Optional[str], Optional[str]]:
        # 1. Try direct file lookup first (for ULID/predictable name)
        direct_path = os.path.join(directory, ulid_filename)
        if os.path.exists(direct_path) and os.path.isfile(direct_path):
            return direct_path, ulid_filename

        # 2. Case-insensitive direct check
        for filename in os.listdir(directory):
            if filename.lower() == ulid_filename.lower():
                return os.path.join(directory, filename), filename

        # 3. Fallback to legacy prefix check
        if prefix_padded or prefix_legacy:
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


def generate_next_id() -> str:
    """Generates a new ULID string."""
    return generate_ulid()


def read_task_file(task_id: str) -> Optional[Dict[str, Any]]:
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
        "color": metadata.get("color", None),
        "body": post.content,
        "created_at": metadata.get("created_at", ""),
        "updated_at": metadata.get("updated_at", ""),
    }


def write_task_file(task_id: str, task_data: Dict[str, Any]) -> str:
    """
    Writes a task file atomically using a temporary file.
    If the project changes, deletes the old file.
    Returns the new filename.
    """
    project_id = task_data.get("project_id", "default")
    project_dir = os.path.join(TASKS_DIR, project_id)
    os.makedirs(project_dir, exist_ok=True)

    new_filename = f"{task_id}.md"
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
        color=task_data.get("color", None),
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
    except Exception as e:
        logger.error(f"Error writing task file for task {task_id}: {e}")
        if os.path.exists(temp_path):
            os.remove(temp_path)
        raise

    # If the filename or project directory changed, delete the old file
    if old_filepath and old_filepath != new_filepath:
        if os.path.exists(old_filepath):
            os.remove(old_filepath)

    return new_filename


def delete_task_file(task_id: str) -> bool:
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
    count = 0
    with db_session() as session:
        # Clear existing tables data
        session.query(Task).delete()
        session.query(Bucket).delete()
        session.query(Project).delete()
        session.flush()

        # Load projects registry
        projects = load_projects_file()
        for p in projects:
            db_project = Project(
                id=p["id"],
                title=p["title"],
                created_at=p["created_at"],
                done_clean_period=p.get("done_clean_period"),
            )
            session.add(db_project)

            # Sync buckets for this project
            buckets = load_buckets_file(p["id"])
            bucket_names = set()
            max_bucket_position = 0.0

            for b in buckets:
                db_bucket = Bucket(
                    project_id=p["id"],
                    name=b["name"],
                    title=b["title"],
                    subtitle=b.get("subtitle", ""),
                    position=b["position"],
                    color=b.get("color", None),
                    layout=b.get("layout", "list"),
                    max_tasks=b.get("max_tasks", None),
                    is_default=b.get("is_default", False),
                )
                session.add(db_bucket)
                bucket_names.add(b["name"])
                max_bucket_position = max(max_bucket_position, b["position"])

            project_dir = os.path.join(TASKS_DIR, p["id"])
            buckets_modified = False

            if os.path.exists(project_dir) and os.path.isdir(project_dir):
                for filename in os.listdir(project_dir):
                    if filename.endswith(".md"):
                        name_without_ext = filename[:-3]

                        # Check if it matches a 26-char Base32 ULID
                        is_ulid = bool(re.match(r"^[0-9A-HJKMNP-TV-Z]{26}$", name_without_ext, re.IGNORECASE))
                        if is_ulid:
                            task_id = name_without_ext.upper()
                        else:
                            # Try legacy numeric format: {digits}-{slug}
                            parts = name_without_ext.split("-", 1)
                            if parts[0].isdigit():
                                task_id = str(int(parts[0]))
                            else:
                                continue

                        filepath = os.path.join(project_dir, filename)
                        try:
                            post = frontmatter.load(filepath)
                            metadata = post.metadata

                            id_val = str(metadata.get("id", task_id))
                            title = metadata.get("title", filename[:-3])
                            bucket = metadata.get("bucket", "todo")
                            position = float(metadata.get("position", 1000.0))
                            tags = [t.lower() for t in metadata.get("tags", [])]
                            due_date = metadata.get("due_date", None)
                            priority = metadata.get("priority", None)
                            color = metadata.get("color", None)
                            body = post.content
                            created_at = metadata.get("created_at", "")
                            updated_at = metadata.get("updated_at", "")

                            # Check if task is done and old, and should be pruned
                            done_clean_period = p.get("done_clean_period")
                            if done_clean_period and done_clean_period > 0 and bucket == "done":
                                check_date = updated_at or created_at
                                if check_date:
                                    try:
                                        updated_dt = datetime.fromisoformat(check_date.replace("Z", "+00:00"))
                                        now = datetime.now(timezone.utc)
                                        age_days = (now - updated_dt).days
                                        if age_days >= done_clean_period:
                                            os.remove(filepath)
                                            logger.info(
                                                f"Pruned old done task file {filename} in project '{p['id']}' "
                                                f"(age: {age_days} days, limit: {done_clean_period})"
                                            )
                                            continue
                                    except Exception as ex:
                                        logger.error(f"Error checking pruning status for {filename} in project '{p['id']}': {ex}")

                            # Auto-create column if it doesn't exist in the project
                            if bucket not in bucket_names:
                                new_title = bucket.replace("-", " ").title()
                                new_pos = max_bucket_position + 1000.0
                                db_bucket = Bucket(
                                    project_id=p["id"],
                                    name=bucket,
                                    title=new_title,
                                    subtitle="",
                                    position=new_pos,
                                    color=None,
                                    layout="list",
                                    max_tasks=None,
                                    is_default=False,
                                )
                                session.add(db_bucket)
                                buckets.append(
                                    {
                                        "name": bucket,
                                        "title": new_title,
                                        "subtitle": "",
                                        "position": new_pos,
                                        "color": None,
                                        "layout": "list",
                                        "max_tasks": None,
                                        "is_default": False,
                                    }
                                )
                                bucket_names.add(bucket)
                                max_bucket_position = new_pos
                                buckets_modified = True

                            db_task = Task(
                                id=id_val,
                                project_id=p["id"],
                                title=title,
                                bucket=bucket,
                                position=position,
                                tags=tags,
                                filename=filename,
                                body=body,
                                due_date=due_date,
                                priority=priority,
                                color=color,
                                created_at=created_at,
                                updated_at=updated_at,
                            )
                            session.add(db_task)
                            count += 1
                        except Exception as e:
                            logger.error(f"Error syncing file {filename} in project {p['id']}: {e}")

            if buckets_modified:
                write_buckets_file(p["id"], buckets)

        session.flush()
    return count
