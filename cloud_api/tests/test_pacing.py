"""Idle requests start immediately; active slots keep their full duration."""
from datetime import datetime, timedelta, timezone

import pytest

from ..pacing import next_slot
from shared.schema import SLOT_SECONDS


@pytest.mark.parametrize('elapsed', [None, SLOT_SECONDS, SLOT_SECONDS + 100])
def test_idle_request_starts_immediately(elapsed):
    now = datetime.now(timezone.utc)
    last = None if elapsed is None else now - timedelta(seconds=elapsed)
    assert next_slot(last, now) == now


@pytest.mark.parametrize('elapsed', [0, 5, SLOT_SECONDS - 0.001, -5])
def test_active_slot_gets_its_remaining_time(elapsed):
    now = datetime.now(timezone.utc)
    last = now - timedelta(seconds=elapsed)
    assert next_slot(last, now) == last + timedelta(seconds=SLOT_SECONDS)


def test_consecutive_slots_are_evenly_spaced():
    now = datetime.now(timezone.utc)
    first = next_slot(None, now)
    second = next_slot(first, now)
    third = next_slot(second, now)
    assert first == now
    assert (second - first).total_seconds() == SLOT_SECONDS
    assert (third - second).total_seconds() == SLOT_SECONDS
