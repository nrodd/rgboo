from types import SimpleNamespace
from unittest.mock import Mock

from ..listener import PendingPoller, PendingWatcher
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
