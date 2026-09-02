"""Pure slot-assignment math for pacing color requests.

Ported from the lock-protected calculation in the original in-process
queue (middleware/color_queue.py: ColorQueue.add_request, lines 41-53).
Kept here as a pure function, independent of Firestore, so it's trivial
to unit test. RequestStore.add_request calls it inside a Firestore
transaction, which is the distributed equivalent of the old
threading.Lock.
"""

from datetime import datetime, timedelta
from typing import Optional

from shared.schema import SLOT_SECONDS


def next_slot(last_scheduled_time: Optional[datetime], now: datetime) -> datetime:
    """Return the scheduled_time for a new request given the pacing clock.

    If the last scheduled slot is already in the past (or there isn't
    one yet), the new request starts SLOT_SECONDS from now; otherwise
    it's queued SLOT_SECONDS after the last slot.
    """
    if last_scheduled_time is None or last_scheduled_time <= now:
        return now + timedelta(seconds=SLOT_SECONDS)
    return last_scheduled_time + timedelta(seconds=SLOT_SECONDS)
