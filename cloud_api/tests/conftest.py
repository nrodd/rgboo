import pytest
from flask import Flask
from unittest.mock import Mock
import datetime

from ..routes import register_routes


@pytest.fixture()
def mock_store():
    store = Mock()

    def add_request(username, r, g, b):
        return {
            "queue_position": 1,
            "estimated_wait_seconds": 20,
            "request_id": "test-req-1",
            "scheduled_time": datetime.datetime.now(datetime.timezone.utc)
        }

    store.add_request.side_effect = add_request
    store.get_queue_status.return_value = {
        'queue_size': 0,
        'worker_running': False,
        'next_available_slot': datetime.datetime.now(datetime.timezone.utc).isoformat(),
        'estimated_wait_for_new_request': 20
    }
    store.get_queue_contents.return_value = []
    store.clear_queue.return_value = 0
    store.get_bridge_status.return_value = {
        'bridge_online': False,
        'serial_connected': None,
        'serial_port': None
    }
    store.get_current_username.return_value = "CurrentUser"
    store.cancel_pending_for_user.return_value = 2
    store.redact_username.return_value = 3
    store.is_blocked.return_value = False
    return store


@pytest.fixture()
def app(mock_store):
    app = Flask(__name__)
    app.testing = True
    register_routes(app, mock_store)
    return app


@pytest.fixture()
def client(app):
    return app.test_client()
