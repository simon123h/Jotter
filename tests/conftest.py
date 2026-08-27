import shutil
import tempfile
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from jotter.app import create_app
from jotter.config import UserConfig
from jotter.db import close_db, get_db
from jotter.services.sync_service import sync_db_only


@pytest.fixture
def temp_dir():
    d = tempfile.mkdtemp(prefix="jotter_test_")
    db_path = str(Path(d) / "tasks.db")
    get_db(db_path)
    sync_db_only(d)
    yield d
    close_db()
    shutil.rmtree(d, ignore_errors=True)


@pytest.fixture
def test_config(temp_dir):
    return UserConfig(
        data_dir=temp_dir,
        port=58299,
        log_level="WARNING",
    )


@pytest.fixture
def test_app(test_config):
    return create_app(test_config)


@pytest.fixture
def client(test_app):
    return TestClient(test_app)


@pytest.fixture
def test_env(temp_dir, test_config, test_app, client):
    yield client, temp_dir
