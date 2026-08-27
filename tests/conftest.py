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
def test_env():
    d = tempfile.mkdtemp(prefix="jotter_test_")
    cfg = UserConfig(
        data_dir=d,
        port=58299,
        log_level="WARNING",
    )
    app = create_app(cfg)
    test_client = TestClient(app)
    yield test_client, d
    close_db()
    shutil.rmtree(d, ignore_errors=True)
