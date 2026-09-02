from datetime import datetime, timedelta, timezone

from ..pacing import next_slot
from shared.schema import SLOT_SECONDS

"""
Unit tests for the pacing slot-assignment math (cloud_api/pacing.py),
ported from middleware/color_queue.py's add_request lock.
"""

"""Test no prior schedule starts SLOT_SECONDS from now"""
def test_no_prior_schedule_starts_from_now():
    now = datetime.now(timezone.utc)
    result = next_slot(None, now)
    assert result == now + timedelta(seconds=SLOT_SECONDS)

"""Test a prior schedule already in the past is treated like no schedule"""
def test_prior_schedule_in_the_past_starts_from_now():
    now = datetime.now(timezone.utc)
    last = now - timedelta(seconds=100)
    result = next_slot(last, now)
    assert result == now + timedelta(seconds=SLOT_SECONDS)

"""Test a prior schedule in the future stacks the new slot after it"""
def test_prior_schedule_in_the_future_stacks_after_it():
    now = datetime.now(timezone.utc)
    last = now + timedelta(seconds=5)
    result = next_slot(last, now)
    assert result == last + timedelta(seconds=SLOT_SECONDS)

"""Test consecutive slots are exactly SLOT_SECONDS apart"""
def test_consecutive_slots_are_evenly_spaced():
    now = datetime.now(timezone.utc)
    first = next_slot(None, now)
    second = next_slot(first, now)
    third = next_slot(second, now)
    assert (second - first).total_seconds() == SLOT_SECONDS
    assert (third - second).total_seconds() == SLOT_SECONDS
