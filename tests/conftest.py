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
