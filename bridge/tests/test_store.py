import datetime

from ..store import to_color_request

"""
Unit tests for parsing Firestore request docs (bridge/store.py). The
Firestore client itself is not exercised here -- the queries it builds
are covered by the Phase 4 manual verification.
"""


class FakeDoc:
    def __init__(self, doc_id, data):
        self.id = doc_id
        self._data = data

    def to_dict(self):
        return self._data


def doc_data(**overrides):
    data = {
        'request_id': 'tester_1700000000_abcd1234',
        'username': 'tester',
        'r': 1,
        'g': 2,
        'b': 3,
        'status': 'pending',
        'scheduled_time': datetime.datetime.now(datetime.timezone.utc),
    }
    data.update(overrides)
    return data


"""Test a well-formed doc parses into the shape the processor expects"""
def test_parses_a_well_formed_doc():
    request = to_color_request(FakeDoc('doc-1', doc_data()))

    assert request.doc_id == 'doc-1'
    assert request.request_id == 'tester_1700000000_abcd1234'
    assert (request.r, request.g, request.b) == (1, 2, 3)
    assert request.status == 'pending'


"""Test a doc missing required fields is skipped rather than raising"""
def test_missing_fields_return_none():
    assert to_color_request(FakeDoc('doc-1', {'username': 'tester'})) is None


"""Test an empty doc is skipped rather than raising"""
def test_empty_doc_returns_none():
    assert to_color_request(FakeDoc('doc-1', None)) is None


"""Test a doc without request_id falls back to the doc id, so logging
still identifies it"""
def test_request_id_falls_back_to_doc_id():
    data = doc_data()
    del data['request_id']

    assert to_color_request(FakeDoc('doc-1', data)).request_id == 'doc-1'
