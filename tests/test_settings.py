"""The settings the views read."""

import pytest
from pydantic import ValidationError

from jotter.features.settings.schemas import AppSettings, SettingsUpdate


def test_the_horizon_defaults_to_today() -> None:
    assert AppSettings().planningHorizon == "today"
    assert AppSettings(planningHorizon="week").planningHorizon == "week"


def test_a_value_that_is_no_horizon_falls_back_in_the_file_and_is_refused_in_an_update() -> None:
    assert AppSettings(planningHorizon="bogus").planningHorizon == "today"
    with pytest.raises(ValidationError):
        SettingsUpdate(planningHorizon="bogus")


def test_an_update_is_checked_again_and_keeps_the_other_settings(tmp_path) -> None:
    from jotter.features.settings.service import SettingsApplicationService

    service = SettingsApplicationService(str(tmp_path))
    service.save_settings(AppSettings(hideDoneColumn=False))
    updated = service.update_settings(SettingsUpdate(planningHorizon="week"))
    assert updated.planningHorizon == "week"
    assert updated.hideDoneColumn is False
    assert service.load_settings().planningHorizon == "week"


def test_views_are_none_until_the_user_has_a_list_and_survive_an_update(tmp_path) -> None:
    from jotter.features.settings.service import SettingsApplicationService

    service = SettingsApplicationService(str(tmp_path))
    assert service.load_settings().views is None

    views = [{"id": "recent", "name": "Recently added", "query": "created:after:-7d sort:-created"}]
    service.update_settings(SettingsUpdate(views=views))
    assert service.update_settings(SettingsUpdate(planningHorizon="week")).views is not None
    loaded = service.load_settings()
    assert [v.model_dump() for v in loaded.views or []] == views

    service.update_settings(SettingsUpdate(views=[]))
    assert service.load_settings().views == []


def test_a_view_needs_an_id_a_name_and_a_query() -> None:
    with pytest.raises(ValidationError):
        SettingsUpdate(views=[{"id": "x", "name": "No query"}])


def test_a_view_that_is_malformed_is_dropped_and_the_other_settings_stay() -> None:
    settings = AppSettings(
        planningHorizon="week",
        views=[
            {"id": "ok", "name": "Fine", "query": "tag:ui"},
            {"name": "No id", "query": "x"},
            "junk",
            {"id": 1, "name": "n", "query": "q"},
        ],
    )
    assert settings.planningHorizon == "week"
    assert [v.id for v in settings.views or []] == ["ok"]
    assert AppSettings(views="junk").views is None
