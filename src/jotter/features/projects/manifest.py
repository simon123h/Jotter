"""Manifest module for reading and writing project index.md files."""

import json
from pathlib import Path
from typing import Any

import yaml

from jotter.features.buckets.domain import DEFAULT_DOMAIN_BUCKETS, Bucket
from jotter.features.projects.domain import Project


def get_index_md_path(project_dir: Path) -> Path:
    return project_dir / "index.md"


def read_project_manifest(project_dir: Path, fallback_id: str) -> tuple[Project, list[Bucket]]:
    """Reads index.md (or falls back to legacy buckets.json / directory name) from project directory."""
    index_file = get_index_md_path(project_dir)
    legacy_buckets_file = project_dir / "buckets.json"

    fm_data: dict[str, Any] = {}
    body = ""

    if index_file.is_file():
        content = index_file.read_text(encoding="utf-8")
        if content.startswith("---"):
            parts = content.split("---", 2)
            if len(parts) >= 3:
                try:
                    loaded = yaml.safe_load(parts[1])
                    if isinstance(loaded, dict):
                        fm_data = loaded
                except Exception:
                    pass
                body = parts[2].lstrip("\r\n")
            else:
                body = content
        else:
            body = content

    # Resolve project fields
    proj_id = str(fm_data.get("id") or fallback_id).strip() or fallback_id
    title = str(fm_data.get("title") or fm_data.get("name") or proj_id.capitalize()).strip()
    description = str(fm_data.get("description") or "").strip()
    git_remote = fm_data.get("git_remote") or fm_data.get("gitRemote")
    git_remote_str = str(git_remote).strip() if git_remote else None
    done_clean_period = fm_data.get("done_clean_period") if "done_clean_period" in fm_data else fm_data.get("doneCleanPeriod")
    clean_period_int = int(done_clean_period) if done_clean_period is not None else None
    created_at = fm_data.get("created_at") or fm_data.get("createdAt")

    project = Project.create(
        name=title,
        project_id=proj_id,
        description=description,
        git_remote=git_remote_str,
        done_clean_period=clean_period_int,
    )
    if created_at:
        project.created_at = str(created_at).strip()

    # Resolve buckets
    raw_buckets = fm_data.get("buckets")
    buckets: list[Bucket] = []

    if isinstance(raw_buckets, list) and raw_buckets:
        for idx, b_item in enumerate(raw_buckets):
            if isinstance(b_item, dict):
                b_name = str(b_item.get("name") or b_item.get("id") or f"column_{idx}").strip()
                b_title = str(b_item.get("title") or b_item.get("name") or b_name.capitalize()).strip()
                b_sub = str(b_item.get("subtitle") or "").strip()
                b_pos = float(b_item.get("position") or (idx + 1) * 1000.0)
                b_color = str(b_item.get("color")).strip() if b_item.get("color") else None
                b_layout = str(b_item.get("layout") or "list")
                b_max = int(b_item["max_tasks"]) if b_item.get("max_tasks") is not None else None
                b_def = bool(b_item.get("is_default", False))
                buckets.append(
                    Bucket(
                        name=b_name,
                        title=b_title,
                        subtitle=b_sub,
                        position=b_pos,
                        color=b_color,
                        layout=b_layout,
                        max_tasks=b_max,
                        is_default=b_def,
                    )
                )
    elif legacy_buckets_file.is_file():
        try:
            with open(legacy_buckets_file, encoding="utf-8") as f:
                l_data = json.load(f)
                if isinstance(l_data, list):
                    for idx, b_item in enumerate(l_data):
                        if isinstance(b_item, dict):
                            b_name = str(b_item.get("name") or f"column_{idx}").strip()
                            b_title = str(b_item.get("title") or b_name.capitalize()).strip()
                            b_sub = str(b_item.get("subtitle") or "").strip()
                            b_pos = float(b_item.get("position") or (idx + 1) * 1000.0)
                            b_color = str(b_item.get("color")).strip() if b_item.get("color") else None
                            b_layout = str(b_item.get("layout") or "list")
                            b_max = int(b_item["max_tasks"]) if b_item.get("max_tasks") is not None else None
                            b_def = bool(b_item.get("is_default", False))
                            buckets.append(
                                Bucket(
                                    name=b_name,
                                    title=b_title,
                                    subtitle=b_sub,
                                    position=b_pos,
                                    color=b_color,
                                    layout=b_layout,
                                    max_tasks=b_max,
                                    is_default=b_def,
                                )
                            )
        except Exception:
            pass

    if not buckets:
        for idx, b_dict in enumerate(DEFAULT_DOMAIN_BUCKETS):
            buckets.append(
                Bucket(
                    name=b_dict["name"],
                    title=b_dict["title"],
                    subtitle=b_dict.get("subtitle", ""),
                    position=float(b_dict.get("position", (idx + 1) * 1000.0)),
                    color=b_dict.get("color"),
                    layout=b_dict.get("layout", "list"),
                    max_tasks=b_dict.get("max_tasks"),
                    is_default=bool(b_dict.get("is_default", False)),
                )
            )

    return project, buckets


def write_project_manifest(
    project_dir: Path,
    project: Project,
    buckets: list[Bucket],
    body: str | None = None,
) -> None:
    """Atomically writes the project index.md file with YAML frontmatter."""
    project_dir.mkdir(parents=True, exist_ok=True)
    index_file = get_index_md_path(project_dir)

    existing_body = ""
    if body is None and index_file.is_file():
        content = index_file.read_text(encoding="utf-8")
        if content.startswith("---"):
            parts = content.split("---", 2)
            if len(parts) >= 3:
                existing_body = parts[2].lstrip("\r\n")
            else:
                existing_body = content
        else:
            existing_body = content

    body_to_write = body if body is not None else existing_body
    if not body_to_write:
        body_to_write = f"# {project.name}\n"

    fm_dict: dict[str, Any] = {
        "type": "project",
        "id": project.id,
        "title": project.name,
    }
    if project.description:
        fm_dict["description"] = project.description
    if project.created_at:
        fm_dict["created_at"] = project.created_at
    if project.done_clean_period is not None:
        fm_dict["done_clean_period"] = project.done_clean_period
    if project.git_remote:
        fm_dict["git_remote"] = project.git_remote

    fm_dict["buckets"] = [
        {
            "name": b.name,
            "title": b.title,
            "subtitle": b.subtitle,
            "position": float(b.position),
            "color": b.color,
            "layout": b.layout,
            "max_tasks": b.max_tasks,
            "is_default": b.is_default,
        }
        for b in buckets
    ]

    yaml_content = yaml.dump(
        fm_dict,
        default_flow_style=False,
        allow_unicode=True,
        sort_keys=False,
    )

    if body_to_write and not body_to_write.startswith("\n"):
        body_to_write = "\n" + body_to_write

    final_content = f"---\n{yaml_content}---\n{body_to_write}"

    tmp_file = index_file.with_suffix(".tmp")
    tmp_file.write_text(final_content, encoding="utf-8")
    tmp_file.replace(index_file)
