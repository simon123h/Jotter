from pathlib import Path
from types import SimpleNamespace

import pytest

from jotter.features.vaults.domain import Vault
from jotter.features.vaults.registry import VaultRegistry
from jotter.features.vaults.schemas import VaultCreate, VaultUpdate
from jotter.features.vaults.service import VaultApplicationService
from jotter.shared.db import ConnectionPool
from jotter.shared.exceptions import ValidationError


def test_vault_domain_entity(temp_dir):
    v = Vault.create(name="Personal Notes", path=temp_dir, vault_id="personal")
    assert v.id == "personal"
    assert v.name == "Personal Notes"
    assert v.path == str(Path(temp_dir).resolve())
    assert v.is_git is False

    with pytest.raises(ValidationError):
        Vault(id="", name="Valid", path=temp_dir)

    with pytest.raises(ValidationError):
        Vault(id="v1", name="", path=temp_dir)


def test_vault_registry_crud(temp_dir):
    config_file = Path(temp_dir) / "vaults.json"
    registry = VaultRegistry(config_file=config_file, default_data_dir=temp_dir)

    # Initial seeding of default vault
    vaults = registry.get_all()
    assert len(vaults) == 1
    assert vaults[0].id == "default"
    assert vaults[0].is_active is True

    # Add second vault
    vault2_path = Path(temp_dir) / "work"
    vault2_path.mkdir()
    v2 = Vault.create(name="Work Vault", path=vault2_path, vault_id="work")
    registry.save(v2)

    all_v = registry.get_all()
    assert len(all_v) == 2

    # Switch active
    registry.set_active_id("work")
    assert registry.get_active().id == "work"

    # Delete
    registry.delete("work")
    assert len(registry.get_all()) == 1
    assert registry.get_active().id == "default"


def test_vault_application_service(temp_dir):
    config_file = Path(temp_dir) / "vaults.json"
    registry = VaultRegistry(config_file=config_file, default_data_dir=temp_dir)
    svc = VaultApplicationService(registry)

    # List
    initial = svc.list_vaults()
    assert len(initial) == 1
    assert initial[0].id == "default"

    # Create new vault
    work_path = Path(temp_dir) / "work_dir"
    created = svc.create_vault(VaultCreate(name="Work Team", path=str(work_path), id="team"))
    assert created.id == "team"
    assert created.path == str(work_path.resolve())

    # Duplicate path error
    with pytest.raises(ValidationError):
        svc.create_vault(VaultCreate(name="Duplicate", path=str(work_path)))

    # Same name, different folder gets a unique ID instead of overwriting
    other = svc.create_vault(VaultCreate(name="Work Team", path=str(Path(temp_dir) / "other_dir")))
    assert other.id == "work-team"
    again = svc.create_vault(VaultCreate(name="Work Team", path=str(Path(temp_dir) / "third_dir")))
    assert again.id == "work-team-2"

    # Opening a missing folder fails when create_dir is False
    with pytest.raises(ValidationError):
        svc.create_vault(VaultCreate(name="Ghost", path=str(Path(temp_dir) / "ghost"), create_dir=False))

    # Rename
    renamed = svc.rename_vault("team", VaultUpdate(name="Team Renamed"))
    assert renamed.name == "Team Renamed"
    svc.delete_vault("work-team-2")
    svc.delete_vault("work-team")

    # Switch
    switched = svc.switch_vault("team")
    assert switched.id == "team"
    assert switched.is_active is True

    active = svc.get_active_vault()
    assert active.id == "team"

    # Delete non-active
    svc.delete_vault("default")
    assert len(svc.list_vaults()) == 1

    # Cannot delete only remaining vault
    with pytest.raises(ValidationError):
        svc.delete_vault("team")

    # Deleting the active vault switches to another one first
    svc.create_vault(VaultCreate(name="Spare", path=str(Path(temp_dir) / "spare"), id="spare"))
    svc.delete_vault("team")
    assert svc.get_active_vault().id == "spare"


def test_vault_api_routes(test_env):
    client, temp_dir = test_env

    # GET /api/vaults
    res = client.get("/api/vaults")
    assert res.status_code == 200
    vaults = res.json()
    assert isinstance(vaults, list)
    assert len(vaults) >= 1

    # GET /api/vaults/active
    active_res = client.get("/api/vaults/active")
    assert active_res.status_code == 200
    assert active_res.json()["is_active"] is True

    # POST /api/vaults
    new_dir = Path(temp_dir) / "api_vault"
    create_res = client.post(
        "/api/vaults",
        json={"name": "Client Vault", "path": str(new_dir), "id": "client-vault"},
    )
    assert create_res.status_code == 201
    assert create_res.json()["id"] == "client-vault"

    # POST /api/vaults/switch
    switch_res = client.post("/api/vaults/switch", json={"vault_id": "client-vault"})
    assert switch_res.status_code == 200
    assert switch_res.json()["id"] == "client-vault"
    assert switch_res.json()["is_active"] is True


def _service_with_two_vaults(temp_dir):
    registry = VaultRegistry(config_file=Path(temp_dir) / "vaults.json", default_data_dir=Path(temp_dir) / "default")
    svc = VaultApplicationService(registry)
    svc.create_vault(VaultCreate(name="Team", path=str(Path(temp_dir) / "team"), id="team"))
    old_pool = ConnectionPool(Path(registry.get_active().path) / "tasks.db")
    state = SimpleNamespace(config=SimpleNamespace(data_dir=registry.get_active().path), db_pool=old_pool)
    return svc, state, old_pool


def test_switching_vaults_publishes_the_new_pool_only_after_its_index_is_synced(temp_dir, monkeypatch):
    from jotter.features.sync.service import SyncApplicationService

    svc, state, old_pool = _service_with_two_vaults(temp_dir)
    seen = {}
    real = SyncApplicationService.sync_on_startup

    def spy(self):
        seen["published_during_sync"] = state.db_pool is not old_pool
        return real(self)

    monkeypatch.setattr(SyncApplicationService, "sync_on_startup", spy)
    svc.switch_vault("team", app_state=state)

    assert seen["published_during_sync"] is False
    assert state.db_pool is not old_pool
    assert state.db_pool.db_path == Path(svc.registry.get("team").path) / "tasks.db"
    assert old_pool._closed
    assert svc.get_active_vault().id == "team"


def test_a_failed_vault_switch_leaves_the_previous_vault_active(temp_dir, monkeypatch):
    from jotter.features.sync.service import SyncApplicationService

    svc, state, old_pool = _service_with_two_vaults(temp_dir)
    previous = svc.get_active_vault().id
    previous_dir = state.config.data_dir

    def boom(self):
        raise RuntimeError("sync failed")

    monkeypatch.setattr(SyncApplicationService, "sync_on_startup", boom)
    with pytest.raises(RuntimeError):
        svc.switch_vault("team", app_state=state)

    assert state.db_pool is old_pool
    assert not old_pool._closed
    assert state.config.data_dir == previous_dir
    assert svc.get_active_vault().id == previous
