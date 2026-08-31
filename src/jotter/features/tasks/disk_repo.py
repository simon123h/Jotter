"""Disk repository for reading and writing task Markdown (.md) files."""

import json
from pathlib import Path

import yaml

from jotter.features.tasks.domain import Task
from jotter.shared.exceptions import EntityNotFoundError, ValidationError
from jotter.shared.value_objects import DueDate


class DiskTaskRepository:
    def __init__(self, data_dir: str):
        self.data_dir = Path(data_dir)

    def get_project_dir(self, project_id: str) -> Path:
        p = self.data_dir / project_id
        p.mkdir(parents=True, exist_ok=True)
        return p

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
        tmp_path = path.with_suffix(".tmp")
        tmp_path.write_text(content, encoding="utf-8")
        tmp_path.replace(path)

    def delete(self, project_id: str, task_id: str) -> None:
        path = self.get_task_file_path(project_id, task_id)
        if path.is_file():
            path.unlink()

    def get_all_task_files(self, project_id: str) -> list[Path]:
        p = self.get_project_dir(project_id)
        return [f for f in p.glob("*.md") if f.is_file()]

    def serialize_task(self, task: Task) -> str:
        """Dumps frontmatter and body into clean markdown format."""
        fm_dict: dict[str, object] = {
            "id": str(task.id),
            "project_id": task.project_id,
            "title": task.title,
            "bucket": task.bucket,
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
        fm_data: dict[str, object] = {}
        body = ""

        if content.startswith("---"):
            parts = content.split("---", 2)
            if len(parts) >= 3:
                try:
                    loaded = yaml.safe_load(parts[1])
                    if isinstance(loaded, dict):
                        fm_data = loaded
                except Exception as e:
                    raise ValidationError(f"Error parsing YAML frontmatter: {e}")
                body = parts[2].lstrip("\r\n")
            else:
                body = content
        else:
            body = content

        tid = str(fm_data.get("id") or fallback_id)
        proj_id = str(default_project_id or fm_data.get("project_id") or fm_data.get("projectId") or "default")
        title = str(fm_data.get("title") or "Untitled Task")
        bucket = str(fm_data.get("bucket") or "todo")
        pos = float(fm_data.get("position") or 1000.0)

        # Parse tags
        raw_tags = fm_data.get("tags")
        tags: list[str] = []
        if isinstance(raw_tags, list):
            tags = [str(t) for t in raw_tags if t is not None]
        elif isinstance(raw_tags, str) and raw_tags.strip():
            tags = [t.strip() for t in raw_tags.split(",")]

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

        # Normalize dates and planned keywords gracefully
        clean_due: str | None = None
        clean_planned: str | None = str(planned_date).strip() if planned_date else None
        if due_date:
            due_str = str(due_date).strip()
            if due_str in (
                "today",
                "tomorrow",
                "thisWeek",
                "nextWeek",
                "thisMonth",
                "nextMonth",
                "thisYear",
                "nextYear",
                "someday",
            ):
                if not clean_planned:
                    clean_planned = due_str
            else:
                if len(due_str) >= 10 and due_str[4] == "-" and due_str[7] == "-":
                    clean_due = due_str[:10]
                else:
                    try:
                        clean_due = DueDate.from_str(due_str).value
                    except Exception:
                        clean_due = None

        clean_postponed: str | None = None
        if postponed_until:
            post_str = str(postponed_until).strip()
            if len(post_str) >= 10 and post_str[4] == "-" and post_str[7] == "-":
                clean_postponed = post_str[:10]
            else:
                try:
                    clean_postponed = DueDate.from_str(post_str).value
                except Exception:
                    clean_postponed = None

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
            priority=str(priority) if priority else None,
            color=str(color) if color else None,
            postponed_until=clean_postponed,
            task_id=tid,
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
