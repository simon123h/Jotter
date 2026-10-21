from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from jotter.app import create_app
from jotter.config import UserConfig


def make_client(temp_dir: str, host: str = "127.0.0.1", name: str = "localhost") -> TestClient:
    config = UserConfig(data_dir=temp_dir, host=host, vaults_config_path=str(Path(temp_dir) / "vaults.json"))
    return TestClient(create_app(config, enable_background_sync=False), base_url=f"http://{name}")


def test_own_pages_and_tools_without_origin_pass(temp_dir: str) -> None:
    with make_client(temp_dir) as client:
        assert client.get("/api/projects").status_code == 200
        assert client.get("/api/projects", headers={"Host": "127.0.0.1:58271"}).status_code == 200
        assert client.get("/api/projects", headers={"Host": "[::1]:58271"}).status_code == 200


@pytest.mark.parametrize("origin", ["http://localhost:5173", "http://127.0.0.1:58271", "http://[::1]:58271"])
def test_pages_of_this_machine_pass(temp_dir: str, origin: str) -> None:
    with make_client(temp_dir) as client:
        response = client.get("/api/projects", headers={"Origin": origin})
        assert response.status_code == 200
        assert response.headers["access-control-allow-origin"] == origin


def test_a_foreign_page_is_turned_away(temp_dir: str) -> None:
    with make_client(temp_dir) as client:
        for method in (client.get, client.post, client.delete):
            assert method("/api/projects", headers={"Origin": "https://evil.example"}).status_code == 403
        assert client.get("/api/projects", headers={"Origin": "null"}).status_code == 403
        preflight = client.options(
            "/api/projects",
            headers={"Origin": "https://evil.example", "Access-Control-Request-Method": "POST"},
        )
        assert preflight.status_code == 403
        assert "access-control-allow-origin" not in preflight.headers


def test_a_name_pointing_at_loopback_is_turned_away(temp_dir: str) -> None:
    """DNS rebinding: the page and its requests share the attacker's name, so the origin alone looks same-origin."""
    with make_client(temp_dir, name="rebind.example") as client:
        response = client.get("/api/projects", headers={"Origin": "http://rebind.example"})
        assert response.status_code == 403
        assert client.get("/api/projects").status_code == 403


def test_a_deliberate_network_bind_keeps_working_under_its_own_name(temp_dir: str) -> None:
    with make_client(temp_dir, host="0.0.0.0", name="desk.lan:58271") as client:
        assert client.get("/api/projects").status_code == 200
        assert client.get("/api/projects", headers={"Origin": "http://desk.lan:58271"}).status_code == 200
        assert client.get("/api/projects", headers={"Origin": "https://evil.example"}).status_code == 403
