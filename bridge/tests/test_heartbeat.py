from unittest.mock import Mock

from ..heartbeat import HeartbeatWriter

"""
Unit tests for the meta/bridge heartbeat (bridge/heartbeat.py), which is
what the cloud API's bridge_online / serial_connected fields read from.
"""


"""Test the heartbeat reports the serial controller's current state"""
def test_beat_writes_serial_state(mock_serial):
    store = Mock()

    HeartbeatWriter(store, mock_serial, 60).beat_once()

    store.write_heartbeat.assert_called_once_with(
        serial_connected=True, serial_port='/dev/ttyUSB0'
    )


"""Test a disconnected ESP32 is reported honestly rather than omitted"""
def test_beat_reports_disconnected_serial(mock_serial):
    store = Mock()
    mock_serial.is_connected.return_value = False
    mock_serial.port = None

    HeartbeatWriter(store, mock_serial, 60).beat_once()

    store.write_heartbeat.assert_called_once_with(
        serial_connected=False, serial_port=None
    )


"""Test a Firestore write failure never propagates out of the heartbeat"""
def test_beat_errors_are_contained(mock_serial):
    store = Mock()
    store.write_heartbeat.side_effect = RuntimeError("unavailable")

    HeartbeatWriter(store, mock_serial, 60).beat_once()  # does not raise
