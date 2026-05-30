import json
import os
import re
import tempfile
import unicodedata
from typing import Any, Dict, Optional, Tuple

import frontmatter

from database import db_session

TASKS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "tasks")

# Ensure the tasks directory exists
os.makedirs(TASKS_DIR, exist_ok=True)

BUCKETS_FILE = os.path.join(TASKS_DIR, "buckets.json")

DEFAULT_BUCKETS = [
    {"name": "backlog", "title": "Backlog", "position": 1000.0},
    {"name": "todo", "title": "To Do", "position": 2000.0},
    {"name": "in-progress", "title": "In Progress", "position": 3000.0},
    {"name": "done", "title": "Done", "position": 4000.0},
]


def load_buckets_file() -> list:
    """Loads buckets from the buckets.json file. If it doesn't exist, writes defaults and returns them."""
    if not os.path.exists(BUCKETS_FILE):
        write_buckets_file(DEFAULT_BUCKETS)
        return DEFAULT_BUCKETS
    try:
        with open(BUCKETS_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return DEFAULT_BUCKETS


def write_buckets_file(buckets: list):
    """Writes the list of buckets to buckets.json atomically."""
    temp_fd, temp_path = tempfile.mkstemp(dir=TASKS_DIR, suffix=".tmp")
    try:
        with os.fdopen(temp_fd, "w", encoding="utf-8") as f:
            json.dump(buckets, f, indent=2)
        os.replace(temp_path, BUCKETS_FILE)
    except Exception:
        if os.path.exists(temp_path):
            os.remove(temp_path)
        raise


def slugify(value: str) -> str:
    """Converts a string to a URL-friendly slug."""
    value = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode("ascii")
    value = re.sub(r"[^\w\s-]", "", value.lower())
    return re.sub(r"[-\s]+", "-", value).strip("-_")


def get_task_file_path(task_id: int) -> Tuple[Optional[str], Optional[str]]:
    """
    Finds the file path for a task ID.
    Returns (absolute_file_path, filename) if found, else (None, None).
    """
    prefix = f"{task_id}-"
    for filename in os.listdir(TASKS_DIR):
        if filename.startswith(prefix) and filename.endswith(".md"):
            return os.path.join(TASKS_DIR, filename), filename
    return None, None


def generate_next_id() -> int:
    """Finds the maximum task ID from files and returns max + 1 (starts at 1000)."""
    max_id = 999
    for filename in os.listdir(TASKS_DIR):
        if filename.endswith(".md"):
            # Try to parse the ID from the filename prefix
            parts = filename.split("-", 1)
            if parts[0].isdigit():
                max_id = max(max_id, int(parts[0]))
    return max_id + 1


def read_task_file(task_id: int) -> Optional[Dict[str, Any]]:
    """Reads a task file and returns a dictionary of its metadata and body."""
    file_path, _ = get_task_file_path(task_id)
    if not file_path or not os.path.exists(file_path):
        return None

    post = frontmatter.load(file_path)
    metadata = post.metadata

    # Ensure standard fields are populated
    return {
        "id": task_id,
        "title": metadata.get("title", ""),
        "bucket": metadata.get("bucket", "todo"),
        "position": float(metadata.get("position", 1000.0)),
        "tags": metadata.get("tags", []),
        "body": post.content,
        "created_at": metadata.get("created_at", ""),
        "updated_at": metadata.get("updated_at", ""),
    }


def write_task_file(task_id: int, task_data: Dict[str, Any]) -> str:
    """
    Writes a task file atomically using a temporary file.
    If the title changes, deletes the old file.
    Returns the new filename.
    """
    slug = slugify(task_data["title"])
    new_filename = f"{task_id}-{slug}.md"
    new_filepath = os.path.join(TASKS_DIR, new_filename)

    old_filepath, old_filename = get_task_file_path(task_id)

    # Prepare the frontmatter post
    post = frontmatter.Post(
        task_data["body"],
        id=task_id,
        title=task_data["title"],
        bucket=task_data["bucket"],
        position=task_data["position"],
        tags=task_data["tags"],
        created_at=task_data["created_at"],
        updated_at=task_data["updated_at"],
    )

    # Atomic write: write to a temp file in the same directory, then rename
    temp_fd, temp_path = tempfile.mkstemp(dir=TASKS_DIR, suffix=".tmp")
    try:
        with os.fdopen(temp_fd, "w", encoding="utf-8") as f:
            frontmatter.dump(post, f)

        # Rename temp file to target path
        os.replace(temp_path, new_filepath)
    except Exception:
        if os.path.exists(temp_path):
            os.remove(temp_path)
        raise

    # If the filename changed, delete the old file
    if old_filepath and old_filepath != new_filepath:
        if os.path.exists(old_filepath):
            os.remove(old_filepath)

    return new_filename


def delete_task_file(task_id: int) -> bool:
    """Deletes a task file. Returns True if deleted, False otherwise."""
    file_path, _ = get_task_file_path(task_id)
    if file_path and os.path.exists(file_path):
        os.remove(file_path)
        return True
    return False


def sync_db_with_files() -> int:
    """
    Clears the SQLite tasks and buckets tables, and rebuilds them.
    Loads buckets from buckets.json and tasks from all markdown files in tasks/.
    Auto-creates missing buckets referenced by task markdown files.
    Returns the count of successfully synchronized tasks.
    """
    count = 0
    with db_session() as conn:
        # Clear existing tables data
        conn.execute("DELETE FROM tasks")
        conn.execute("DELETE FROM buckets")

        # Sync buckets first
        buckets = load_buckets_file()
        bucket_names = set()
        max_bucket_position = 0.0

        for b in buckets:
            conn.execute(
                "INSERT INTO buckets (name, title, position) VALUES (?, ?, ?)",
                (b["name"], b["title"], b["position"]),
            )
            bucket_names.add(b["name"])
            max_bucket_position = max(max_bucket_position, b["position"])

        buckets_modified = False

        for filename in os.listdir(TASKS_DIR):
            if filename.endswith(".md"):
                parts = filename.split("-", 1)
                if not parts[0].isdigit():
                    continue
                task_id = int(parts[0])

                filepath = os.path.join(TASKS_DIR, filename)
                try:
                    post = frontmatter.load(filepath)
                    metadata = post.metadata

                    id_val = int(metadata.get("id", task_id))
                    title = metadata.get("title", filename[:-3])
                    bucket = metadata.get("bucket", "todo")
                    position = float(metadata.get("position", 1000.0))
                    tags = metadata.get("tags", [])
                    created_at = metadata.get("created_at", "")
                    updated_at = metadata.get("updated_at", "")

                    # Auto-create column if it doesn't exist
                    if bucket not in bucket_names:
                        new_title = bucket.replace("-", " ").title()
                        new_pos = max_bucket_position + 1000.0
                        conn.execute(
                            "INSERT INTO buckets (name, title, position) VALUES (?, ?, ?)",
                            (bucket, new_title, new_pos),
                        )
                        buckets.append({"name": bucket, "title": new_title, "position": new_pos})
                        bucket_names.add(bucket)
                        max_bucket_position = new_pos
                        buckets_modified = True

                    conn.execute(
                        """
                        INSERT INTO tasks (
                            id, title, bucket, position, tags, filename, created_at, updated_at
                        )
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                        (
                            id_val,
                            title,
                            bucket,
                            position,
                            json.dumps(tags),
                            filename,
                            created_at,
                            updated_at,
                        ),
                    )
                    count += 1
                except Exception as e:
                    print(f"Error syncing file {filename}: {e}")

        if buckets_modified:
            write_buckets_file(buckets)

    return count
