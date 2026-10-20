"""The settings the views read: the horizon replaced the switch for postponed tasks."""

import pytest
from pydantic import ValidationError

from jotter.features.settings.schemas import AppSettings, SettingsUpdate


def test_the_old_switch_for_postponed_tasks_becomes_a_horizon() -> None:
    assert AppSettings(hidePostponedColumn=False).planningHorizon == "all"
    assert AppSettings(hidePostponedColumn=True).planningHorizon == "today"
    assert AppSettings().planningHorizon == "today"
    assert not hasattr(AppSettings(hidePostponedColumn=False), "hidePostponedColumn")


def test_a_stored_horizon_wins_over_the_old_switch() -> None:
    assert AppSettings(hidePostponedColumn=False, planningHorizon="week").planningHorizon == "week"


def test_a_value_that_is_no_horizon_falls_back_in_the_file_and_is_refused_in_an_update() -> None:
    assert AppSettings(planningHorizon="bogus").planningHorizon == "today"
    with pytest.raises(ValidationError):
        SettingsUpdate(planningHorizon="bogus")
