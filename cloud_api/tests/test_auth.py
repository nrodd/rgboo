from unittest.mock import Mock
import datetime

from ..app import create_app
from ..config import Config

"""
Unit tests for the auth enforced in cloud_api/app.py.

Three-way split: the health check is open, /admin/* needs X-Admin-Key, and
everything else needs the Worker's X-Api-Key. The admin path deliberately
does NOT accept X-Api-Key -- the Worker adds that header to every request it
proxies, so it identifies the Worker rather than a person.

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
    store.clear_queue.return_value = 0
    store.get_current_username.return_value = None
    store.is_blocked.return_value = False
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


"""Test the admin path rejects the Worker's API key -- the whole point of a
separate secret, since every visitor's request carries the Worker's one"""
def test_admin_rejects_the_worker_api_key(monkeypatch):
    monkeypatch.setattr(Config, 'API_KEY', 'test-secret')
    monkeypatch.setattr(Config, 'ADMIN_KEY', 'admin-secret')
    client = create_app(store=_fake_store()).test_client()

    response = client.post('/admin/clear-current', headers={'X-Api-Key': 'test-secret'})
    assert response.status_code == 401


"""Test the admin path rejects a missing key"""
def test_admin_rejects_missing_key(monkeypatch):
    monkeypatch.setattr(Config, 'API_KEY', 'test-secret')
    monkeypatch.setattr(Config, 'ADMIN_KEY', 'admin-secret')
    client = create_app(store=_fake_store()).test_client()

    assert client.post('/admin/clear-current').status_code == 401


"""Test the admin path rejects the wrong admin key"""
def test_admin_rejects_wrong_key(monkeypatch):
    monkeypatch.setattr(Config, 'API_KEY', 'test-secret')
    monkeypatch.setattr(Config, 'ADMIN_KEY', 'admin-secret')
    client = create_app(store=_fake_store()).test_client()

    response = client.post('/admin/clear-current', headers={'X-Admin-Key': 'nope'})
    assert response.status_code == 401


"""Test the admin path accepts the admin key"""
def test_admin_accepts_admin_key(monkeypatch):
    monkeypatch.setattr(Config, 'API_KEY', 'test-secret')
    monkeypatch.setattr(Config, 'ADMIN_KEY', 'admin-secret')
    client = create_app(store=_fake_store()).test_client()

    response = client.post('/admin/clear-current', headers={'X-Admin-Key': 'admin-secret'})
    assert response.status_code == 200


"""Test an unset ADMIN_KEY fails closed rather than leaving the door open"""
def test_unset_admin_key_fails_closed(monkeypatch):
    monkeypatch.setattr(Config, 'API_KEY', 'test-secret')
    monkeypatch.setattr(Config, 'ADMIN_KEY', None)
    client = create_app(store=_fake_store()).test_client()

    response = client.post('/admin/clear-current', headers={'X-Admin-Key': 'anything'})
    assert response.status_code == 500


"""Test an unset ADMIN_KEY does not break ordinary API traffic"""
def test_unset_admin_key_leaves_the_api_working(monkeypatch):
    monkeypatch.setattr(Config, 'API_KEY', 'test-secret')
    monkeypatch.setattr(Config, 'ADMIN_KEY', None)
    client = create_app(store=_fake_store()).test_client()

    response = client.get('/api/queue', headers={'X-Api-Key': 'test-secret'})
    assert response.status_code == 200


"""Test the admin key does not unlock the regular API"""
def test_admin_key_does_not_work_on_the_api(monkeypatch):
    monkeypatch.setattr(Config, 'API_KEY', 'test-secret')
    monkeypatch.setattr(Config, 'ADMIN_KEY', 'admin-secret')
    client = create_app(store=_fake_store()).test_client()

    response = client.get('/api/queue', headers={'X-Admin-Key': 'admin-secret'})
    assert response.status_code == 401


"""Test clearing the whole queue is admin-only: it cancels other people's
colours, so a visitor must not be able to trigger it"""
def test_queue_clear_requires_the_admin_key(monkeypatch):
    monkeypatch.setattr(Config, 'API_KEY', 'test-secret')
    monkeypatch.setattr(Config, 'ADMIN_KEY', 'admin-secret')
    client = create_app(store=_fake_store()).test_client()

    assert client.post('/admin/queue/clear',
                       headers={'X-Api-Key': 'test-secret'}).status_code == 401
    assert client.post('/admin/queue/clear',
                       headers={'X-Admin-Key': 'admin-secret'}).status_code == 200


"""Test the old public path is gone, not merely unauthorised"""
def test_the_old_public_clear_path_no_longer_exists(monkeypatch):
    monkeypatch.setattr(Config, 'API_KEY', 'test-secret')
    monkeypatch.setattr(Config, 'ADMIN_KEY', 'admin-secret')
    client = create_app(store=_fake_store()).test_client()

    response = client.post('/api/queue/clear', headers={'X-Api-Key': 'test-secret'})
    assert response.status_code == 404


"""Test reading the queue stays public -- it is the same information the site
already shows, and only the destructive half moved"""
def test_reading_the_queue_is_still_api_key_only(monkeypatch):
    monkeypatch.setattr(Config, 'API_KEY', 'test-secret')
    monkeypatch.setattr(Config, 'ADMIN_KEY', 'admin-secret')
    client = create_app(store=_fake_store()).test_client()

    assert client.get('/api/queue', headers={'X-Api-Key': 'test-secret'}).status_code == 200
