"""Pure slot-assignment math for pacing color requests.

Kept as a pure function, independent of Firestore, so it's trivial to
unit test. RequestStore.add_request calls it inside a Firestore
transaction, which is what serialises concurrent submissions.
"""

from datetime import datetime, timedelta
from typing import Optional

from shared.schema import SLOT_SECONDS


def next_slot(last_scheduled_time: Optional[datetime], now: datetime) -> datetime:
    """Return the scheduled_time for a new request given the pacing clock.

    An idle queue starts immediately. Otherwise, wait only until the
    previous slot has had its full SLOT_SECONDS, including when that
    slot started recently and is already in the past.
    """
    if last_scheduled_time is None:
        return now
    return max(now, last_scheduled_time + timedelta(seconds=SLOT_SECONDS))
