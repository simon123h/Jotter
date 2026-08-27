import json
import shutil
import threading
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from jotter.db import get_db
from jotter.services.bucket_service import load_buckets_file
from jotter.services.git_service import git_sync
from jotter.services.project_service import load_projects_file
from jotter.services.settings_service import load_settings
from jotter.services.task_service import parse_frontmatter

_sync_lock = threading.Lock()


def sync_db_only(data_dir: str) -> int:
    tasks_path = Path(data_dir)
    tasks_path.mkdir(parents=True, exist_ok=True)

    projects_data = load_projects_file(data_dir)
    registered_project_ids = {p["id"] for p in projects_data}

    # Auto-register any existing directories that might not yet be in projects.json
    now_str = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    for entry in tasks_path.iterdir():
        if entry.is_dir() and not entry.name.startswith(".") and entry.name not in registered_project_ids:
            p_id = entry.name
            projects_data.append(
                {
                    "id": p_id,
                    "title": p_id.replace("-", " ").title(),
                    "created_at": now_str,
                    "done_clean_period": None,
                    "git_remote": None,
                }
            )
            registered_project_ids.add(p_id)

    clean_periods: dict[str, int | None] = {p["id"]: p.get("done_clean_period") for p in projects_data}

    all_buckets: list[dict[str, Any]] = []
    bucket_lookup: dict[str, set[str]] = {}
    all_tasks: list[dict[str, Any]] = []

    now = datetime.now(timezone.utc)

    # 1. Scan project folders & buckets
    for p in projects_data:
        p_id = p["id"]
        project_dir = tasks_path / p_id
        if not project_dir.is_dir():
            continue

        raw_buckets = load_buckets_file(data_dir, p_id)
        bucket_lookup[p_id] = set()
        for b in raw_buckets:
            b_name = b["name"]
            bucket_lookup[p_id].add(b_name)
            all_buckets.append(
                {
                    "project_id": p_id,
                    "name": b_name,
                    "title": b["title"],
                    "subtitle": b.get("subtitle", ""),
                    "position": float(b.get("position", 1000.0)),
                    "color": b.get("color"),
                    "layout": b.get("layout", "list"),
                    "max_tasks": b.get("max_tasks"),
                    "is_default": bool(b.get("is_default", False)),
                }
            )

        # 2. Scan Task Files
        clean_days = clean_periods.get(p_id)

        for file_path in project_dir.iterdir():
            if not file_path.is_file() or not file_path.name.endswith(".md"):
                continue

            task_id = file_path.stem
            try:
                content = file_path.read_text(encoding="utf-8")
                fm, body = parse_frontmatter(content)

                # Auto-prune completed tasks if threshold is configured
                if clean_days and clean_days > 0 and fm.bucket == "done":
                    try:
                        updated_time = datetime.fromisoformat(fm.updated_at.replace("Z", "+00:00"))
                        age_days = (now - updated_time).total_seconds() / 86400.0
                        if age_days >= clean_days:
                            file_path.unlink(missing_ok=True)
                            att_dir = project_dir / f"{task_id}.attachments"
                            if att_dir.is_dir():
                                shutil.rmtree(att_dir, ignore_errors=True)
                            continue
                    except Exception:
                        pass

                # If task references a bucket not present in buckets.json, ensure bucket exists
                target_bucket = fm.bucket or "backlog"
                if target_bucket not in bucket_lookup[p_id]:
                    # Create the missing bucket dynamically in the index
                    all_buckets.append(
                        {
                            "project_id": p_id,
                            "name": target_bucket,
                            "title": target_bucket.replace("-", " ").title(),
                            "subtitle": "",
                            "position": 9999.0,
                            "color": None,
                            "layout": "list",
                            "max_tasks": None,
                            "is_default": False,
                        }
                    )
                    bucket_lookup[p_id].add(target_bucket)

                all_tasks.append(
                    {
                        "id": fm.id or task_id,
                        "project_id": p_id,
                        "title": fm.title,
                        "bucket": target_bucket,
                        "position": fm.position,
                        "tags": fm.tags,
                        "attachments": fm.attachments or [],
                        "filename": file_path.name,
                        "body": body,
                        "due_date": fm.due_date,
                        "planned_date": fm.planned_date,
                        "priority": fm.priority,
                        "color": fm.color,
                        "postponed_until": fm.postponed_until,
                        "created_at": fm.created_at,
                        "updated_at": fm.updated_at,
                    }
                )
            except Exception:
                continue

    # Rebuild SQLite in an atomic transaction
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("BEGIN TRANSACTION;")
    try:
        cursor.execute("DELETE FROM tasks;")
        cursor.execute("DELETE FROM buckets;")
        cursor.execute("DELETE FROM projects;")

        for p in projects_data:
            cursor.execute(
                "INSERT INTO projects (id, title, created_at, done_clean_period, git_remote) VALUES (?, ?, ?, ?, ?)",
                (p["id"], p["title"], p["created_at"], p.get("done_clean_period"), p.get("git_remote")),
            )

        for b in all_buckets:
            cursor.execute(
                """
                INSERT INTO buckets (project_id, name, title, subtitle, position, color, layout, max_tasks, is_default)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    b["project_id"],
                    b["name"],
                    b["title"],
                    b["subtitle"],
                    b["position"],
                    b["color"],
                    b["layout"],
                    b["max_tasks"],
                    1 if b["is_default"] else 0,
                ),
            )

        for t in all_tasks:
            try:
                cursor.execute(
                    """
                    INSERT INTO tasks (
                        id, project_id, title, bucket, position, tags, attachments, filename, body,
                        due_date, planned_date, priority, color, postponed_until, created_at, updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        t["id"],
                        t["project_id"],
                        t["title"],
                        t["bucket"],
                        t["position"],
                        json.dumps(t["tags"] or []),
                        json.dumps(t["attachments"] or []),
                        t["filename"],
                        t["body"],
                        t["due_date"],
                        t["planned_date"],
                        t["priority"],
                        t["color"],
                        t["postponed_until"],
                        t["created_at"],
                        t["updated_at"],
                    ),
                )
            except Exception as e:
                print(f"[Sync] Warning: Skipping invalid task record {t.get('id')}: {e}")

        cursor.execute("COMMIT;")
    except Exception as e:
        cursor.execute("ROLLBACK;")
        raise e

    return len(all_tasks)


def full_sync(data_dir: str) -> int:
    with _sync_lock:
        settings = load_settings(data_dir)
        projects = load_projects_file(data_dir)

        git_errors: list[str] = []

        # 1. Global Sync
        if settings.gitRemoteUrl:
            # Write dynamic .gitignore
            ignored = [p["id"] for p in projects if p.get("git_remote")]
            lines = ["# Auto-generated by Jotter global git sync", "*.tmp", "tasks.db", "tasks.db-*", "settings.json"]
            for ign in ignored:
                lines.append(f"{ign}/")
            gitignore_path = Path(data_dir) / ".gitignore"
            gitignore_path.write_text("\n".join(lines) + "\n", encoding="utf-8")

            err_global = git_sync(data_dir, settings.gitRemoteUrl)
            if err_global:
                git_errors.append(f"Workspace: {err_global}")

        # 2. Per-project sync
        for p in projects:
            p_id = p["id"]
            remote = p.get("git_remote")
            project_path = str(Path(data_dir) / p_id)
            if remote:
                err_proj = git_sync(project_path, remote)
                if err_proj:
                    git_errors.append(f"Project '{p_id}': {err_proj}")
            elif not settings.gitRemoteUrl:
                err_proj = git_sync(project_path, None)
                if err_proj:
                    git_errors.append(f"Project '{p_id}': {err_proj}")

        if git_errors:
            msg = "Git Synchronization issues:\n" + "\n".join(git_errors)
            raise RuntimeError(msg)

        return sync_db_only(data_dir)
