import json
import re
from pathlib import Path

import pytest

from jotter.features.projects.domain import Project
from jotter.features.projects.repo import ProjectRepository
from jotter.features.tasks.schemas import TaskCreate, TaskUpdate
from jotter.features.tasks.service import TaskApplicationService
from jotter.shared.db import create_sqlite_connection
from jotter.shared.exceptions import TaskOperationError
from jotter.shared.slug import RESERVED_TASK_NAMES, task_slug, unique_task_name

FIXTURE = json.loads((Path(__file__).parent.parent / "spec/fixtures/filenames/slug.json").read_text(encoding="utf-8"))


@pytest.mark.parametrize("case", FIXTURE["cases"], ids=lambda c: c["description"])
def test_slug_follows_the_spec_fixture(case):
    assert task_slug(case["title"]) == case["slug"]


def test_reserved_names_are_the_spec_fixtures():
    assert set(FIXTURE["reserved"]) == RESERVED_TASK_NAMES


def test_a_free_name_stays_plain_and_a_taken_one_gets_a_random_suffix():
    assert unique_task_name("buy-milk", lambda name: False) == "buy-milk"
    taken = {"buy-milk"}
    name = unique_task_name("buy-milk", lambda n: n in taken)
    assert re.fullmatch(r"buy-milk-[a-z0-9]{4}", name)


@pytest.mark.parametrize("name", sorted(FIXTURE["reserved"]))
def test_reserved_names_always_get_a_suffix(name):
    assert re.fullmatch(rf"{name}-[a-z0-9]{{4}}", unique_task_name(name, lambda n: False))


def _service(temp_dir):
    conn = create_sqlite_connection(str(Path(temp_dir) / "tasks.db"))
    repo = ProjectRepository(temp_dir, conn)
    for pid in ("home", "work"):
        repo.save(Project.create(name=pid.capitalize(), project_id=pid))
    return TaskApplicationService.from_data_dir(temp_dir, conn)


def test_a_new_task_is_named_after_its_title(temp_dir):
    svc = _service(temp_dir)
    task = svc.create_task("home", TaskCreate(title="Grocery shopping", bucket="todo"))
    assert task.id == "grocery-shopping"
    assert (Path(temp_dir) / "home" / "grocery-shopping.md").is_file()


def test_the_same_title_again_gets_a_suffix_also_in_another_project(temp_dir):
    svc = _service(temp_dir)
    first = svc.create_task("home", TaskCreate(title="Buy milk", bucket="todo"))
    same_project = svc.create_task("home", TaskCreate(title="Buy milk", bucket="todo"))
    other_project = svc.create_task("work", TaskCreate(title="Buy milk", bucket="todo"))

    assert first.id == "buy-milk"
    assert re.fullmatch(r"buy-milk-[a-z0-9]{4}", same_project.id)
    assert re.fullmatch(r"buy-milk-[a-z0-9]{4}", other_project.id)  # the index keys tasks by id alone
    assert len({first.id, same_project.id, other_project.id}) == 3


def test_a_title_named_like_the_manifest_does_not_take_its_name(temp_dir):
    svc = _service(temp_dir)
    task = svc.create_task("home", TaskCreate(title="Index", bucket="todo"))
    assert re.fullmatch(r"index-[a-z0-9]{4}", task.id)


def test_a_new_title_never_renames_the_file(temp_dir):
    svc = _service(temp_dir)
    task = svc.create_task("home", TaskCreate(title="Grocery shopping", bucket="todo"))
    updated = svc.update_task("home", task.id, TaskUpdate(title="Weekly shopping"))
    assert updated.id == "grocery-shopping"
    assert (Path(temp_dir) / "home" / "grocery-shopping.md").is_file()


def test_moving_a_task_into_a_project_that_has_the_name_does_not_overwrite_it(temp_dir):
    svc = _service(temp_dir)
    svc.create_task("home", TaskCreate(title="Plan", bucket="todo"))
    # A name another tool wrote into the other project
    (Path(temp_dir) / "work" / "plan.md").write_text(
        "---\ntype: task\nid: plan\nproject_id: work\ntitle: Other\nstatus: todo\n---\nKeep me\n", encoding="utf-8"
    )
    with pytest.raises(TaskOperationError):
        svc.update_task("home", "plan", TaskUpdate(project_id="work"))
    assert "Keep me" in (Path(temp_dir) / "work" / "plan.md").read_text(encoding="utf-8")
