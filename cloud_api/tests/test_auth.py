from unittest.mock import Mock
import datetime

from .. import app as app_module
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
    store.get_current_username.return_value = None
    return store


def _client(monkeypatch):
    monkeypatch.setattr(Config, 'API_KEY', 'test-secret')
    return create_app(store=_fake_store()).test_client()


def test_health_check_does_not_require_api_key(monkeypatch):
    client = _client(monkeypatch)
    assert client.get('/').status_code == 200


def test_missing_api_key_is_rejected(monkeypatch):
    client = _client(monkeypatch)
    assert client.get('/api/queue').status_code == 401


def test_correct_api_key_is_accepted(monkeypatch):
    client = _client(monkeypatch)
    assert client.get('/api/queue', headers={'X-Api-Key': 'test-secret'}).status_code == 200


def test_admin_requires_access_configuration(monkeypatch):
    client = _client(monkeypatch)
    monkeypatch.setattr(Config, 'ACCESS_TEAM_DOMAIN', '')
    monkeypatch.setattr(Config, 'ACCESS_AUDIENCE', None)
    monkeypatch.setattr(Config, 'ADMIN_EMAILS', set())
    assert client.get('/admin/status').status_code == 500


def test_admin_requires_access_jwt(monkeypatch):
    client = _client(monkeypatch)
    monkeypatch.setattr(Config, 'ACCESS_TEAM_DOMAIN', 'https://team.cloudflareaccess.com')
    monkeypatch.setattr(Config, 'ACCESS_AUDIENCE', 'aud')
    monkeypatch.setattr(Config, 'ADMIN_EMAILS', {'admin@example.com'})
    assert client.get('/admin/status').status_code == 401


def test_valid_access_jwt_allows_an_admin(monkeypatch):
    client = _client(monkeypatch)
    monkeypatch.setattr(Config, 'ACCESS_TEAM_DOMAIN', 'https://team.cloudflareaccess.com')
    monkeypatch.setattr(Config, 'ACCESS_AUDIENCE', 'aud')
    monkeypatch.setattr(Config, 'ADMIN_EMAILS', {'admin@example.com'})

    class SigningKey:
        key = 'public-key'

    class Jwks:
        def get_signing_key_from_jwt(self, token):
            return SigningKey()

    monkeypatch.setattr(app_module.jwt, 'PyJWKClient', lambda url: Jwks())
    monkeypatch.setattr(app_module.jwt, 'decode', lambda *args, **kwargs: {'email': 'admin@example.com'})

    response = client.get('/admin/status', headers={'Cf-Access-Jwt-Assertion': 'signed-token'})
    assert response.status_code == 200


def test_valid_access_jwt_rejects_non_admin(monkeypatch):
    client = _client(monkeypatch)
    monkeypatch.setattr(Config, 'ACCESS_TEAM_DOMAIN', 'https://team.cloudflareaccess.com')
    monkeypatch.setattr(Config, 'ACCESS_AUDIENCE', 'aud')
    monkeypatch.setattr(Config, 'ADMIN_EMAILS', {'admin@example.com'})
    monkeypatch.setattr(app_module.jwt, 'PyJWKClient', lambda url: Mock(get_signing_key_from_jwt=lambda token: Mock(key='key')))
    monkeypatch.setattr(app_module.jwt, 'decode', lambda *args, **kwargs: {'email': 'visitor@example.com'})

    response = client.get('/admin/status', headers={'Cf-Access-Jwt-Assertion': 'signed-token'})
    assert response.status_code == 403
