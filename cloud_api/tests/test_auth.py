from unittest.mock import Mock
import datetime

from ..app import create_app
from ..config import Config


def _fake_store():
    store = Mock()
    store.get_bridge_status.return_value = {
        'bridge_online': False, 'serial_connected': None, 'serial_port': None
    }
    store.get_queue_status.return_value = {
        'queue_size': 0,
        'worker_running': False,
        'next_available_slot': datetime.datetime.now(datetime.timezone.utc).isoformat(),
        'estimated_wait_for_new_request': 20,
    }
    store.get_queue_contents.return_value = []
    store.get_queue_size.return_value = 0
    store.get_current_username.return_value = None
    return store


def _client(monkeypatch):
    monkeypatch.setattr(Config, 'API_KEY', 'test-secret')
    return create_app(store=_fake_store()).test_client()


def test_health_check_does_not_require_api_key(monkeypatch):
    assert _client(monkeypatch).get('/').status_code == 200


def test_missing_api_key_is_rejected(monkeypatch):
    assert _client(monkeypatch).get('/api/queue').status_code == 401


def test_correct_api_key_is_accepted(monkeypatch):
    client = _client(monkeypatch)
    assert client.get('/api/queue', headers={'X-Api-Key': 'test-secret'}).status_code == 200


def test_admin_requires_api_key(monkeypatch):
    client = _client(monkeypatch)
    assert client.get('/admin/status').status_code == 401


def test_admin_accepts_worker_api_key(monkeypatch):
    client = _client(monkeypatch)
    assert client.get('/admin/status', headers={'X-Api-Key': 'test-secret'}).status_code == 200


def test_unset_api_key_fails_closed_for_admin(monkeypatch):
    client = _client(monkeypatch)
    monkeypatch.setattr(Config, 'API_KEY', None)
    assert client.get('/admin/status').status_code == 500


def test_admin_does_not_accept_cloudflare_header_without_api_key(monkeypatch):
    client = _client(monkeypatch)
    assert client.get('/admin/status', headers={'Cf-Access-Jwt-Assertion': 'anything'}).status_code == 401
