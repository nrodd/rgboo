from unittest.mock import Mock
import datetime

from ..app import create_app
from ..config import Config

"""
Unit tests for the X-Api-Key auth enforced in cloud_api/app.py.

Uses create_app(store=...) with a fake store so no real Firestore client
is ever constructed here.
"""


def _fake_store():
    store = Mock()
    store.get_bridge_status.return_value = {
        'bridge_online': False,
        'serial_connected': None,
        'serial_port': None
    }
    store.get_queue_status.return_value = {
        'queue_size': 0,
        'worker_running': False,
        'next_available_slot': datetime.datetime.now(datetime.timezone.utc).isoformat(),
        'estimated_wait_for_new_request': 20
    }
    store.get_queue_contents.return_value = []
    return store


"""Test the health check stays open even without a key"""
def test_health_check_does_not_require_api_key(monkeypatch):
    monkeypatch.setattr(Config, 'API_KEY', 'test-secret')
    client = create_app(store=_fake_store()).test_client()

    response = client.get('/')
    assert response.status_code == 200


"""Test a protected endpoint rejects a missing key"""
def test_missing_api_key_is_rejected(monkeypatch):
    monkeypatch.setattr(Config, 'API_KEY', 'test-secret')
    client = create_app(store=_fake_store()).test_client()

    response = client.get('/api/queue')
    assert response.status_code == 401


"""Test a protected endpoint rejects the wrong key"""
def test_wrong_api_key_is_rejected(monkeypatch):
    monkeypatch.setattr(Config, 'API_KEY', 'test-secret')
    client = create_app(store=_fake_store()).test_client()

    response = client.get('/api/queue', headers={'X-Api-Key': 'nope'})
    assert response.status_code == 401


"""Test a protected endpoint accepts the correct key"""
def test_correct_api_key_is_accepted(monkeypatch):
    monkeypatch.setattr(Config, 'API_KEY', 'test-secret')
    client = create_app(store=_fake_store()).test_client()

    response = client.get('/api/queue', headers={'X-Api-Key': 'test-secret'})
    assert response.status_code == 200


"""Test a misconfigured server (no API_KEY set) fails closed"""
def test_missing_server_side_key_is_a_500(monkeypatch):
    monkeypatch.setattr(Config, 'API_KEY', None)
    client = create_app(store=_fake_store()).test_client()

    response = client.get('/api/queue', headers={'X-Api-Key': 'anything'})
    assert response.status_code == 500
