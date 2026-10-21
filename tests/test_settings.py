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
