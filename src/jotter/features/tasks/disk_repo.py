"""Disk repository for reading and writing task Markdown (.md) files."""

import json
import os
from pathlib import Path
from typing import Any

import yaml

from jotter.features.tasks.domain import DueDate, Priority, Tag, Task, is_planning_keyword
from jotter.shared.exceptions import EntityNotFoundError, ValidationError
from jotter.shared.frontmatter import split_frontmatter
from jotter.shared.yaml_io import safe_load


def _is_valid_tag(tag: str) -> bool:
    try:
        Tag(tag)
    except ValidationError:
        return False
    return True


def _clean_date(raw: object) -> str | None:
    """A planning keyword or a YYYY-MM-DD date (a time part is dropped); anything else is dropped."""
    if not raw:
        return None
    try:
        return DueDate.from_str(str(raw)).value
    except ValidationError:
        return None


def _clean_priority(raw: object) -> str | None:
    if not raw:
        return None
    try:
        return Priority.from_str(str(raw)).value
    except ValidationError:
        return None


class DiskTaskRepository:
    def __init__(self, data_dir: Path | str):
        self.data_dir = Path(data_dir)

    def get_project_dir(self, project_id: str) -> Path:
        # Pure path lookup: reads must never (re)create a project folder, otherwise a late request
        # for a deleted project resurrects it. Writers create the folder themselves.
        return self.data_dir / project_id

    def get_task_file_path(self, project_id: str, task_id: str) -> Path:
        return self.get_project_dir(project_id) / f"{task_id}.md"

    def exists(self, project_id: str, task_id: str) -> bool:
        return self.get_task_file_path(project_id, task_id).is_file()

    def get_task(self, project_id: str, task_id: str) -> Task:
        path = self.get_task_file_path(project_id, task_id)
        if not path.is_file():
            raise EntityNotFoundError(f"Task '{task_id}' not found in project '{project_id}'")
        return self.read_task_file(path, default_project_id=project_id)

    def save(self, task: Task) -> None:
        """Atomically writes the task Markdown file with YAML frontmatter."""
        path = self.get_task_file_path(task.project_id, str(task.id))
        content = self.serialize_task(task)
        parent_dir = path.parent
        parent_dir.mkdir(parents=True, exist_ok=True)

        import re

        from jotter.shared.fs import atomic_write

        safe_slug = re.sub(r"[^\w\-.]", "_", str(task.id))
        atomic_write(path, content, encoding="utf-8", prefix=f".{safe_slug}_", suffix=".tmp")

    def delete(self, project_id: str, task_id: str) -> None:
        path = self.get_task_file_path(project_id, task_id)
        if path.is_file():
            path.unlink()

    def scan_task_files(self, project_id: str) -> list[tuple[Path, os.stat_result]]:
        """Lists a project's task files with their stat results, from a single directory scan.

        On Windows the scan itself returns size and mtime, so no per-file system call is needed. That matters where
        antivirus or EDR filter drivers make every call expensive.
        """
        p = self.get_project_dir(project_id)
        found: list[tuple[Path, os.stat_result]] = []
        try:
            with os.scandir(p) as entries:
                for entry in entries:
                    name = entry.name
                    if name.startswith(".") or name.lower() in ("index.md", "readme.md"):
                        continue
                    if not (name.lower().endswith(".md") if os.name == "nt" else name.endswith(".md")):
                        continue
                    try:
                        if entry.is_file():
                            found.append((Path(entry.path), entry.stat()))
                    except OSError:
                        continue  # vanished or locked between listing and stat: the next sync sees it
        except OSError:
            return []
        return found

    def serialize_task(self, task: Task) -> str:
        """Dumps frontmatter and body into clean markdown format adhering to OKF standard."""
        fm_dict: dict[str, object] = {
            "type": "task",
            "id": str(task.id),
            "project_id": task.project_id,
            "title": task.title,
            "status": task.bucket,
            "position": float(task.position),
            "created_at": task.created_at,
            "updated_at": task.updated_at,
        }
        if task.tags:
            fm_dict["tags"] = [t.value for t in task.tags]
        if task.attachments:
            fm_dict["attachments"] = list(task.attachments)
        if task.due_date.value:
            fm_dict["due_date"] = task.due_date.value
        if task.planned_date.value:
            fm_dict["planned_date"] = task.planned_date.value
        if task.priority.value != "none":
            fm_dict["priority"] = task.priority.value
        if task.color:
            fm_dict["color"] = task.color
        if task.postponed_until.value:
            fm_dict["postponed_until"] = task.postponed_until.value

        # Preserve unknown / extra frontmatter keys
        if task.extra_frontmatter:
            for k, v in task.extra_frontmatter.items():
                if k not in fm_dict and k not in ("bucket",):
                    fm_dict[k] = v

        yaml_content = yaml.dump(
            fm_dict,
            default_flow_style=False,
            allow_unicode=True,
            sort_keys=False,
        )

        body_str = task.body or ""
        if body_str and not body_str.startswith("\n"):
            body_str = "\n" + body_str

        return f"---\n{yaml_content}---\n{body_str}"

    def read_task_file(self, file_path: Path, default_project_id: str) -> Task:
        content = file_path.read_text(encoding="utf-8")
        return self.parse_task_content(content, file_path.stem, default_project_id)

    def parse_task_content(self, content: str, fallback_id: str, default_project_id: str) -> Task:
        """Parses frontmatter and body, returning a domain Task entity."""
        fm_data: dict[str, Any] = {}

        yaml_text, body = split_frontmatter(content)
        if yaml_text is not None:
            try:
                loaded = safe_load(yaml_text)
            except Exception as e:
                raise ValidationError(f"Error parsing YAML frontmatter: {e}") from e
            if isinstance(loaded, dict):
                fm_data = loaded

        tid = str(fm_data.get("id") or fallback_id)
        proj_id = str(default_project_id or fm_data.get("project_id") or fm_data.get("projectId") or "default")
        title = str(fm_data.get("title") or "Untitled Task")
        # Prefer 'status' with backwards-compatible fallback to 'bucket'
        bucket = str(fm_data.get("status") or fm_data.get("bucket") or "todo")
        try:
            pos = float(fm_data.get("position") or 1000.0)
        except (TypeError, ValueError):
            pos = 1000.0

        # Parse tags
        raw_tags = fm_data.get("tags")
        tags: list[str] = []
        if isinstance(raw_tags, list):
            tags = [str(t) for t in raw_tags if t is not None]
        elif isinstance(raw_tags, str) and raw_tags.strip():
            tags = [t.strip() for t in raw_tags.split(",")]
        tags = [t for t in tags if _is_valid_tag(t)]

        # Parse attachments
        raw_att = fm_data.get("attachments")
        attachments: list[str] = []
        if isinstance(raw_att, list):
            attachments = [str(a) for a in raw_att if a is not None]
        elif isinstance(raw_att, str) and raw_att.strip():
            try:
                parsed = json.loads(raw_att)
                if isinstance(parsed, list):
                    attachments = [str(a) for a in parsed if a is not None]
            except Exception:
                attachments = [raw_att.strip()]

        due_date = fm_data.get("due_date") or fm_data.get("dueDate")
        planned_date = fm_data.get("planned_date") or fm_data.get("plannedDate")
        priority = fm_data.get("priority")
        color = fm_data.get("color")
        postponed_until = fm_data.get("postponed_until") or fm_data.get("postponedUntil")

        # A planning keyword in due_date is a planned date. Values that are neither a keyword nor a date are dropped.
        clean_due = _clean_date(due_date)
        clean_planned = _clean_date(planned_date)
        if due_date and is_planning_keyword(str(due_date)):
            clean_due = None
            clean_planned = clean_planned or str(due_date).strip()
        clean_postponed = _clean_date(postponed_until)

        # Collect unknown / extra frontmatter keys
        known_keys = {
            "type",
            "id",
            "project_id",
            "projectId",
            "title",
            "status",
            "bucket",
            "position",
            "tags",
            "attachments",
            "due_date",
            "dueDate",
            "planned_date",
            "plannedDate",
            "priority",
            "color",
            "postponed_until",
            "postponedUntil",
            "created_at",
            "createdAt",
            "updated_at",
            "updatedAt",
        }
        extra_fm = {k: v for k, v in fm_data.items() if k not in known_keys}

        task = Task.create(
            project_id=proj_id,
            title=title,
            bucket=bucket,
            position=pos,
            tags=tags,
            attachments=attachments,
            body=body,
            due_date=clean_due,
            planned_date=clean_planned,
            priority=_clean_priority(priority),
            color=str(color) if color else None,
            postponed_until=clean_postponed,
            task_id=tid,
            extra_frontmatter=extra_fm,
        )

        created_val = fm_data.get("created_at") or fm_data.get("createdAt")
        if created_val:
            if hasattr(created_val, "isoformat"):
                task.created_at = created_val.isoformat()
            else:
                task.created_at = str(created_val).strip()

        updated_val = fm_data.get("updated_at") or fm_data.get("updatedAt")
        if updated_val:
            if hasattr(updated_val, "isoformat"):
                task.updated_at = updated_val.isoformat()
            else:
                task.updated_at = str(updated_val).strip()

        return task
