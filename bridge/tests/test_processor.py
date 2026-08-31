import datetime
from unittest.mock import Mock

from shared.schema import STATUS_CANCELLED
from ..processor import ColorProcessor
from .conftest import make_request

"""
Unit tests for the dispatch loop (bridge/processor.py), ported from
middleware/color_queue.py's worker loop. Waits are kept tiny so ticks
return immediately.
"""


def build(mock_store, mock_serial, obs_callback=None):
    return ColorProcessor(
        mock_store,
        mock_serial,
        obs_update_callback=obs_callback,
        idle_wait_seconds=0.01,
        max_wait_seconds=0.01,
    )


"""Test a request whose slot has arrived is sent to the ESP32 and marked done.
The color sent is the re-read one, not the queued copy, so an edit between
queueing and dispatch cannot send a stale value."""
def test_due_request_is_sent_and_marked_done(mock_store, mock_serial):
    processor = build(mock_store, mock_serial)
    processor.upsert(make_request(offset_seconds=-1, r=1, g=2, b=3))
    mock_store.reload.side_effect = lambda doc_id: make_request(
        doc_id=doc_id, r=4, g=5, b=6
    )

    dispatched = processor._tick()

    assert dispatched is not None
    mock_serial.send_color.assert_called_once_with(4, 5, 6)
    mock_store.mark_done.assert_called_once_with("doc-1")
    assert processor.pending_count() == 0


"""Test a request whose slot is still in the future is not sent yet"""
def test_future_request_is_not_dispatched_yet(mock_store, mock_serial):
    processor = build(mock_store, mock_serial)
    processor.upsert(make_request(offset_seconds=60))

    assert processor._tick() is None
    mock_serial.send_color.assert_not_called()
    assert processor.pending_count() == 1


"""Test a request cancelled after queueing is skipped -- this is how
POST /api/queue/clear stops the LEDs changing"""
def test_cancelled_request_is_skipped_on_reread(mock_store, mock_serial):
    processor = build(mock_store, mock_serial)
    processor.upsert(make_request(offset_seconds=-1))
    mock_store.reload.side_effect = lambda doc_id: make_request(
        doc_id=doc_id, status=STATUS_CANCELLED
    )

    processor._tick()

    mock_serial.send_color.assert_not_called()
    mock_store.mark_done.assert_not_called()


"""Test a request deleted before dispatch is skipped without error"""
def test_vanished_request_is_skipped(mock_store, mock_serial):
    processor = build(mock_store, mock_serial)
    processor.upsert(make_request(offset_seconds=-1))
    mock_store.reload.side_effect = lambda doc_id: None

    processor._tick()

    mock_serial.send_color.assert_not_called()
    mock_store.mark_done.assert_not_called()


"""Test a failed serial write marks the request failed with the error"""
def test_failed_serial_write_marks_failed(mock_store, mock_serial):
    mock_serial.send_color.return_value = (False, "Could not establish serial connection")
    processor = build(mock_store, mock_serial)
    processor.upsert(make_request(offset_seconds=-1))

    processor._tick()

    mock_store.mark_done.assert_not_called()
    mock_store.mark_failed.assert_called_once_with(
        "doc-1", "Could not establish serial connection"
    )


"""Test the earliest scheduled request is dispatched first, whatever the
order the snapshot delivered them in"""
def test_earliest_slot_is_dispatched_first(mock_store, mock_serial):
    processor = build(mock_store, mock_serial)
    processor.upsert(make_request(doc_id="later", username="later", offset_seconds=-1))
    processor.upsert(make_request(doc_id="sooner", username="sooner", offset_seconds=-30))
    mock_store.reload.side_effect = lambda doc_id: make_request(
        doc_id=doc_id, username=doc_id
    )

    dispatched = processor._tick()

    assert dispatched.doc_id == "sooner"
    assert processor.pending_count() == 1


"""Test OBS is updated even when the serial write fails, matching the old
worker loop's behaviour"""
def test_obs_updated_even_when_serial_fails(mock_store, mock_serial):
    mock_serial.send_color.return_value = (False, "boom")
    obs_callback = Mock(return_value=True)
    processor = build(mock_store, mock_serial, obs_callback)
    processor.upsert(make_request(offset_seconds=-1, username="alice"))
    mock_store.reload.side_effect = lambda doc_id: make_request(
        doc_id=doc_id, username="alice"
    )

    processor._tick()

    obs_callback.assert_called_once_with("alice")


"""Test a raising OBS callback does not stop the request being closed out"""
def test_obs_callback_error_does_not_break_dispatch(mock_store, mock_serial):
    obs_callback = Mock(side_effect=RuntimeError("socket gone"))
    processor = build(mock_store, mock_serial, obs_callback)
    processor.upsert(make_request(offset_seconds=-1))

    processor._tick()

    mock_store.mark_done.assert_called_once_with("doc-1")


"""Test sync() replaces known requests, so a cancellation missed by the
listener still drops out of the queue"""
def test_sync_replaces_known_requests(mock_store, mock_serial):
    processor = build(mock_store, mock_serial)
    processor.upsert(make_request(doc_id="stale", offset_seconds=60))

    processor.sync([make_request(doc_id="fresh", offset_seconds=60)])

    assert processor.pending_count() == 1
    assert processor._tick() is None


"""Test discard() drops a request before it is ever dispatched"""
def test_discard_removes_pending_request(mock_store, mock_serial):
    processor = build(mock_store, mock_serial)
    processor.upsert(make_request(offset_seconds=-1))

    processor.discard("doc-1")

    assert processor._tick() is None
    mock_serial.send_color.assert_not_called()


"""Test an overdue request left behind by a bridge restart is processed
immediately -- the durability win over the old in-memory queue"""
def test_overdue_request_from_restart_is_processed_immediately(mock_store, mock_serial):
    processor = build(mock_store, mock_serial)
    processor.upsert(make_request(offset_seconds=-3600))

    assert processor._tick() is not None
    mock_serial.send_color.assert_called_once()


"""Test an empty queue just waits instead of dispatching anything"""
def test_empty_queue_dispatches_nothing(mock_store, mock_serial):
    processor = build(mock_store, mock_serial)

    assert processor._tick() is None
    mock_serial.send_color.assert_not_called()


"""Test stop() ends the run loop"""
def test_stop_ends_run_loop(mock_store, mock_serial):
    processor = build(mock_store, mock_serial)
    processor.stop()

    processor.run()  # returns immediately rather than hanging

    assert processor.pending_count() == 0
