"""Replays the adapter scenarios (spec/fixtures/adapter) through the REST API.

The static demo of the web app is a second implementation of the same data layer. It replays the same scenarios in
apps/web/src/storage/__tests__/adapterContract.spec.ts, so a feature that the backend has and the demo lacks (or the
other way round) fails there, instead of showing as a bug to the first visitor.
"""

import json
from pathlib import Path
from typing import Any

import pytest
from fastapi.testclient import TestClient

SCENARIOS = json.loads(
    (Path(__file__).resolve().parent.parent / "spec" / "fixtures" / "adapter" / "scenarios.json").read_text(
        encoding="utf-8"
    )
)["scenarios"]


def _call(client: TestClient, op: str, args: list[Any]) -> Any:
    """The StorageAdapter operation `op`, as the HTTP adapter of the web app sends it."""
    match op:
        case "createProject":
            response = client.post("/api/projects", json={"title": args[0]})
        case "updateProject":
            response = client.put(f"/api/projects/{args[0]}", json=args[1])
        case "deleteProject":
            response = client.delete(f"/api/projects/{args[0]}")
        case "getProjects":
            response = client.get("/api/projects")
        case "getBuckets":
            response = client.get(f"/api/projects/{args[0]}/buckets")
        case "createTask":
            response = client.post(f"/api/projects/{args[0]}/tasks", json=args[1])
        case "updateTask":
            response = client.put(f"/api/projects/{args[0]}/tasks/{args[1]}", json=args[2])
        case "moveTask":
            response = client.patch(
                f"/api/projects/{args[0]}/tasks/{args[1]}/move", json={"bucket": args[2], "position": args[3]}
            )
        case "deleteTask":
            response = client.delete(f"/api/projects/{args[0]}/tasks/{args[1]}")
        case "getTask":
            response = client.get(f"/api/projects/{args[0]}/tasks/{args[1]}")
        case "getTasks":
            response = client.get(f"/api/projects/{args[0]}/tasks", params=args[1] if len(args) > 1 else None)
        case "getAllTasks":
            response = client.get("/api/tasks", params=args[0] if args else None)
        case _:
            raise AssertionError(f"unknown operation {op}")
    assert response.status_code < 400, f"{op}: {response.status_code} {response.text}"
    return response.json() if response.content else None


def _resolve(value: Any, saved: dict[str, Any]) -> Any:
    if isinstance(value, dict) and set(value) == {"$ref"}:
        found: Any = saved
        for part in value["$ref"].split("."):
            found = found[part]
        return found
    if isinstance(value, dict):
        return {key: _resolve(item, saved) for key, item in value.items()}
    if isinstance(value, list):
        return [_resolve(item, saved) for item in value]
    return value


def _check(step: dict[str, Any], result: Any) -> None:
    where = f"{step['op']} {step.get('args')}"
    if "match" in step:
        for key, expected in step["match"].items():
            assert result.get(key) == expected, f"{where}: {key} is {result.get(key)!r}, expected {expected!r}"
    for key in step.get("absent", []):
        assert result.get(key) in (None, "", []), f"{where}: {key} is {result.get(key)!r}, expected none"
    if "pick" in step:
        picked = [item[step["pick"]] for item in result]
        if "equals" in step:
            assert picked == step["equals"], f"{where}: {picked!r}"
        for member in step.get("includes", []):
            assert member in picked, f"{where}: {member!r} missing from {picked!r}"
        for member in step.get("excludes", []):
            assert member not in picked, f"{where}: {member!r} found in {picked!r}"


@pytest.mark.parametrize("scenario", SCENARIOS, ids=[s["name"] for s in SCENARIOS])
def test_scenario(test_env, scenario):
    if "backend" in scenario.get("skip", {}):
        pytest.skip(scenario["skip"]["backend"])
    client, _ = test_env
    saved: dict[str, Any] = {}
    for step in scenario["steps"]:
        result = _call(client, step["op"], _resolve(step["args"], saved))
        if "save" in step:
            saved[step["save"]] = result
        _check(step, result)
