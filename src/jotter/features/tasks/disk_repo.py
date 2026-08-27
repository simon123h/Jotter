"""Disk repository for reading and writing task Markdown (.md) files."""

import json
from pathlib import Path
import yaml

from jotter.features.tasks.domain import Task
from jotter.shared.exceptions import EntityNotFoundError, ValidationError


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
        """Dumps frontmatter and body into markdown format."""
        fm_dict: dict[str, object] = {
            "id": str(task.id),
            "project_id": task.project_id,
            "title": task.title,
            "bucket": task.bucket,
            "position": float(task.position),
            "tags": [t.value for t in task.tags],
            "attachments": list(task.attachments),
            "created_at": task.created_at,
            "updated_at": task.updated_at,
        }
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
        proj_id = str(fm_data.get("project_id") or default_project_id)
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

        due_date = str(fm_data["due_date"]) if fm_data.get("due_date") else None
        planned_date = str(fm_data["planned_date"]) if fm_data.get("planned_date") else None
        priority = str(fm_data["priority"]) if fm_data.get("priority") else None
        color = str(fm_data["color"]) if fm_data.get("color") else None
        postponed_until = str(fm_data["postponed_until"]) if fm_data.get("postponed_until") else None

        task = Task.create(
            project_id=proj_id,
            title=title,
            bucket=bucket,
            position=pos,
            tags=tags,
            attachments=attachments,
            body=body,
            due_date=due_date,
            planned_date=planned_date,
            priority=priority,
            color=color,
            postponed_until=postponed_until,
            task_id=tid,
        )

        if fm_data.get("created_at"):
            task.created_at = str(fm_data["created_at"])
        if fm_data.get("updated_at"):
            task.updated_at = str(fm_data["updated_at"])

        return task
