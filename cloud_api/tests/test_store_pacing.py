"""Queue responses and persisted slots agree for idle and busy queues."""
from datetime import datetime, timedelta, timezone
from unittest.mock import Mock, patch

import pytest

from ..store import RequestStore
from shared.schema import SLOT_SECONDS


@pytest.mark.parametrize('elapsed,wait', [
    (None, 0), (100, 0), (SLOT_SECONDS, 0), (5, SLOT_SECONDS - 5),
    (-5, SLOT_SECONDS + 5),
])
def test_submission_and_queue_status_use_same_slot(elapsed, wait):
    now = datetime(2026, 9, 27, tzinfo=timezone.utc)
    store = RequestStore(Mock())
    store._pacing_ref = Mock()
    store._requests = Mock()
    snapshot = store._pacing_ref.get.return_value
    snapshot.exists = elapsed is not None
    snapshot.to_dict.return_value = {
        'last_scheduled_time': None if elapsed is None else now - timedelta(seconds=elapsed)
    }
    store._pending_count = Mock(return_value=0)
    store.get_bridge_status = Mock(return_value={'bridge_online': True})

    with patch('cloud_api.store.datetime') as clock, patch(
        'cloud_api.store.firestore.transactional', side_effect=lambda fn: fn
    ):
        clock.now.return_value = now
        status = store.get_queue_status()
        result = store.add_request('alice', 1, 2, 3)

    expected = now + timedelta(seconds=wait)
    assert status['next_available_slot'] == expected.isoformat()
    assert status['estimated_wait_for_new_request'] == wait
    assert result['scheduled_time'] == expected
    assert result['estimated_wait_seconds'] == wait
    assert store._requests.document.return_value.set.call_args.args[0]['scheduled_time'] == expected
    store._client.transaction.return_value.set.assert_called_once_with(
        store._pacing_ref, {'last_scheduled_time': expected}
    )
