import datetime
from unittest.mock import Mock

import pytest

from ..store import ColorRequest


def make_request(doc_id="doc-1", username="tester", offset_seconds=-1, status="pending",
                 r=10, g=20, b=30) -> ColorRequest:
    """A ColorRequest scheduled relative to now (negative = already due)."""
    return ColorRequest(
        doc_id=doc_id,
        request_id=f"{username}_1",
        username=username,
        r=r,
        g=g,
        b=b,
        status=status,
        scheduled_time=datetime.datetime.now(datetime.timezone.utc)
        + datetime.timedelta(seconds=offset_seconds),
    )


@pytest.fixture()
def mock_store():
    """A BridgeStore stand-in whose reload() echoes back what was queued."""
    store = Mock()
    store.list_pending.return_value = []
    store.reload.side_effect = lambda doc_id: make_request(doc_id=doc_id)
    return store


@pytest.fixture()
def mock_serial():
    serial = Mock()
    serial.port = '/dev/ttyUSB0'
    serial.is_connected.return_value = True
    serial.send_color.return_value = (True, "Color sent successfully")
    return serial
