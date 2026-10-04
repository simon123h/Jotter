import tempfile
from collections.abc import Generator
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from jotter.app import create_app
from jotter.config import UserConfig
from jotter.shared.db import close_db, get_db


@pytest.fixture
def temp_dir() -> Generator[str, None, None]:
    with tempfile.TemporaryDirectory(ignore_cleanup_errors=True) as td:
        yield td


@pytest.fixture(autouse=True)
def isolated_user_dirs(tmp_path_factory, monkeypatch):
    """Keep tests from reading or writing the developer's real jotter.yaml / vaults.json."""
    home = tmp_path_factory.mktemp("home")
    monkeypatch.chdir(home)  # portable ./jotter.yaml is searched before the global config
    monkeypatch.setenv("HOME", str(home))
    monkeypatch.setenv("XDG_CONFIG_HOME", str(home / ".config"))
    monkeypatch.setenv("XDG_DATA_HOME", str(home / ".local" / "share"))
    monkeypatch.setenv("APPDATA", str(home / "AppData"))


@pytest.fixture
def test_env(temp_dir: str) -> Generator[tuple[TestClient, str], None, None]:
    db_file = Path(temp_dir) / "tasks.db"
    get_db(str(db_file))

    config = UserConfig(
        data_dir=temp_dir,
        port=8000,
        vaults_config_path=str(Path(temp_dir) / "vaults.json"),
    )
    app = create_app(config, enable_watcher=False)

    with TestClient(app) as client:
        yield client, temp_dir

    close_db()
