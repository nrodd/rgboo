from types import SimpleNamespace
from unittest.mock import Mock

from ..listener import OverlayControlWatcher, PendingPoller, PendingWatcher
from .conftest import make_request

"""
Unit tests for the two ways pending requests reach the processor
(bridge/listener.py): the Firestore snapshot listener and the poller.
"""


class FakeDoc:
    """Stands in for a Firestore DocumentSnapshot."""

    def __init__(self, doc_id, data):
        self.id = doc_id
        self._data = data

    def to_dict(self):
        return self._data


def change(change_type, doc):
    return SimpleNamespace(type=SimpleNamespace(name=change_type), document=doc)


def pending_doc(doc_id="doc-1", username="tester"):
    request = make_request(doc_id=doc_id, username=username)
    return FakeDoc(doc_id, {
        'request_id': request.request_id,
        'username': username,
        'r': request.r,
        'g': request.g,
        'b': request.b,
        'status': 'pending',
        'scheduled_time': request.scheduled_time,
    })


"""Test a newly added pending doc is handed to the processor"""
def test_added_document_is_upserted():
    processor = Mock()
    watcher = PendingWatcher(Mock(), processor)

    watcher._on_snapshot([], [change('ADDED', pending_doc())], None)

    assert processor.upsert.call_args[0][0].doc_id == "doc-1"


"""Test a doc leaving the pending query is dropped from the processor"""
def test_removed_document_is_discarded():
    processor = Mock()
    watcher = PendingWatcher(Mock(), processor)

    watcher._on_snapshot([], [change('REMOVED', pending_doc())], None)

    processor.discard.assert_called_once_with("doc-1")
    processor.upsert.assert_not_called()


"""Test a malformed doc is skipped rather than taking the listener down"""
def test_malformed_document_is_skipped():
    processor = Mock()
    watcher = PendingWatcher(Mock(), processor)

    watcher._on_snapshot([], [change('ADDED', FakeDoc("bad", {'username': 'x'}))], None)

    processor.upsert.assert_not_called()


"""Test a failure inside the callback never propagates into the gRPC thread"""
def test_snapshot_errors_are_contained():
    processor = Mock()
    processor.upsert.side_effect = RuntimeError("boom")
    watcher = PendingWatcher(Mock(), processor)

    watcher._on_snapshot([], [change('ADDED', pending_doc())], None)  # does not raise


"""Test stopping the watcher unsubscribes from the stream"""
def test_stop_unsubscribes():
    store = Mock()
    watch = Mock()
    store.watch_pending.return_value = watch
    watcher = PendingWatcher(store, Mock())

    watcher.start()
    watcher.stop()

    watch.unsubscribe.assert_called_once()


"""Test a poll hands the processor the full authoritative pending set"""
def test_poll_syncs_full_pending_set():
    store = Mock()
    requests = [make_request(doc_id="a"), make_request(doc_id="b")]
    store.list_pending.return_value = requests
    processor = Mock()

    PendingPoller(store, processor, 1).poll_once()

    processor.sync.assert_called_once_with(requests)


"""Test a Firestore outage during a poll is logged, not raised"""
def test_poll_errors_are_contained():
    store = Mock()
    store.list_pending.side_effect = RuntimeError("unavailable")
    processor = Mock()

    PendingPoller(store, processor, 1).poll_once()  # does not raise

    processor.sync.assert_not_called()


"""Test the overlay watcher hands the timestamp to the controller"""
def test_overlay_snapshot_reaches_the_controller():
    controller = Mock()
    watcher = OverlayControlWatcher(Mock(), controller)

    watcher._on_snapshot([FakeDoc("overlay_control", {"clear_requested_at": "T"})], [], None)

    controller.handle.assert_called_once_with("T")


"""Test an empty overlay doc is passed through as None rather than raising"""
def test_empty_overlay_doc_is_safe():
    controller = Mock()
    watcher = OverlayControlWatcher(Mock(), controller)

    watcher._on_snapshot([FakeDoc("overlay_control", {})], [], None)

    controller.handle.assert_called_once_with(None)


"""Test an error in the overlay callback never escapes into the gRPC thread"""
def test_overlay_snapshot_errors_are_contained():
    controller = Mock()
    controller.handle.side_effect = RuntimeError("boom")
    watcher = OverlayControlWatcher(Mock(), controller)

    watcher._on_snapshot([FakeDoc("overlay_control", {"clear_requested_at": "T"})], [], None)


"""Test the resync poll also re-checks the overlay control doc, so an admin
clear still lands if the snapshot stream has quietly died"""
def test_poll_also_checks_overlay_control():
    store = Mock()
    store.list_pending.return_value = []
    controller = Mock()

    PendingPoller(store, Mock(), 1, controller).poll_once()

    controller.check_now.assert_called_once()


"""Test the poll still checks the overlay even when listing pending fails"""
def test_overlay_checked_even_if_pending_listing_fails():
    store = Mock()
    store.list_pending.side_effect = RuntimeError("unavailable")
    controller = Mock()

    PendingPoller(store, Mock(), 1, controller).poll_once()

    controller.check_now.assert_called_once()


"""Test a poller with no controller (poll mode without OBS) still works"""
def test_poller_without_a_controller_is_fine():
    store = Mock()
    store.list_pending.return_value = []

    PendingPoller(store, Mock(), 1).poll_once()
