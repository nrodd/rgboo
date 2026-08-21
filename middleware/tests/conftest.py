import pytest
from flask import Flask
from unittest.mock import Mock
import datetime

from ..routes import register_routes


@pytest.fixture()
def mock_serial_controller():
    mc = Mock()
    mc.is_connected.return_value = False
    mc.get_port_info.return_value = None
    mc.get_available_ports.return_value = []
    return mc


@pytest.fixture()
def mock_color_queue():
    mq = Mock()

    def add_request(username, r, g, b):
        return {
            "queue_position": 1,
            "estimated_wait_seconds": 20,
            "request_id": "test-req-1",
            "scheduled_time": datetime.datetime.now()
        }

    mq.add_request.side_effect = add_request
    mq.get_queue_status.return_value = {
        'queue_size': 0,
        'worker_running': False,
        'next_available_slot': datetime.datetime.now().isoformat(),
        'estimated_wait_for_new_request': 20
    }
    mq.get_queue_contents.return_value = []
    mq.clear_queue.return_value = 0
    return mq


@pytest.fixture()
def app(mock_serial_controller, mock_color_queue):
    app = Flask(__name__)
    app.testing = True
    register_routes(app, mock_serial_controller, mock_color_queue)
    return app


@pytest.fixture()
def client(app):
    return app.test_client()