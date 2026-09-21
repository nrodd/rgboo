from types import SimpleNamespace
from unittest.mock import Mock

from ..serial_controller import SerialController


def port(device, description, vid, pid):
    return SimpleNamespace(
        device=device,
        description=description,
        hwid='',
        vid=vid,
        pid=pid,
    )


def test_auto_detect_prefers_pico2(monkeypatch):
    ports = [
        port('COM3', 'Silicon Labs CP210x', 0x10C4, 0xEA60),
        port('COM7', 'USB Serial Device', 0x2E8A, 0x000F),
    ]
    monkeypatch.setattr(
        'bridge.serial_controller.serial.tools.list_ports.comports',
        lambda: ports,
    )

    assert SerialController().find_controller_port() == 'COM7'


def test_auto_detect_accepts_pico2_composite_pid(monkeypatch):
    monkeypatch.setattr(
        'bridge.serial_controller.serial.tools.list_ports.comports',
        lambda: [port('COM8', 'Pico 2', 0x2E8A, 0xC10F)],
    )

    assert SerialController().find_controller_port() == 'COM8'


def test_connect_opens_port_and_probes_firmware(monkeypatch):
    connection = Mock(is_open=True, in_waiting=0)
    serial_factory = Mock(return_value=connection)
    monkeypatch.setattr('bridge.serial_controller.serial.Serial', serial_factory)
    monkeypatch.setattr('bridge.serial_controller.time.sleep', lambda _seconds: None)

    controller = SerialController()

    assert controller.connect('COM7') is True
    serial_factory.assert_called_once_with(
        port='COM7',
        baudrate=115200,
        timeout=2,
        write_timeout=2,
    )
    connection.reset_input_buffer.assert_called_once_with()
    connection.write.assert_called_once_with(b'TEST\n')


def test_send_color_uses_firmware_protocol(monkeypatch):
    connection = Mock(is_open=True, in_waiting=0)
    controller = SerialController()
    controller.serial_connection = connection
    controller.port = 'COM7'
    monkeypatch.setattr('bridge.serial_controller.time.sleep', lambda _seconds: None)

    assert controller.send_color(12, 34, 56) == (True, 'Color sent successfully')
    connection.write.assert_called_once_with(b'RGB:12,34,56\n')
    connection.flush.assert_called_once_with()
