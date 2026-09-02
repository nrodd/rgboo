from ..dry_run import DryRunSerialController

"""
Unit tests for the --dry-run serial stand-in (bridge/dry_run.py). The
point of dry-run is that the old middleware keeps owning the USB port,
so the important assertions are about what it does *not* do.
"""


"""Test a dry-run color write reports success without opening a port"""
def test_send_color_succeeds_without_a_port():
    controller = DryRunSerialController()

    success, message = controller.send_color(255, 0, 128)

    assert success is True
    assert controller.port is None


"""Test dry-run heartbeats report serial as disconnected, so the cloud API
does not claim the bridge is driving the LEDs"""
def test_reports_not_connected():
    controller = DryRunSerialController()

    assert controller.connect() is True
    assert controller.is_connected() is False
    assert controller.port is None


"""Test it satisfies the interface the processor and heartbeat rely on"""
def test_matches_serial_controller_interface():
    controller = DryRunSerialController()

    for method in ('connect', 'disconnect', 'is_connected', 'send_color'):
        assert callable(getattr(controller, method))
