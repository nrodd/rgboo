import datetime
from unittest.mock import Mock

from shared.schema import DEFAULT_OBS_USERNAME
from ..overlay_control import OverlayController

"""
Unit tests for acting on an admin overlay clear (bridge/overlay_control.py).

The cloud cannot reach this machine, so the clear arrives as a Firestore
document. The controller's job is to blank the overlay exactly once per
request, however many times that document is delivered.
"""


def at(seconds):
    """A timestamp `seconds` after a fixed origin."""
    return datetime.datetime(2026, 1, 1, tzinfo=datetime.timezone.utc) + \
        datetime.timedelta(seconds=seconds)


def build(last_request=None):
    store = Mock()
    store.read_overlay_clear_request.return_value = last_request
    obs = Mock(return_value=True)
    return OverlayController(store, obs), store, obs


"""Test a clear request blanks the overlay with the default name"""
def test_request_blanks_the_overlay():
    controller, _, obs = build()

    assert controller.handle(at(10)) is True
    obs.assert_called_once_with(DEFAULT_OBS_USERNAME)


"""Test the same request delivered twice only clears once -- snapshots repeat,
and the resync poll re-reads the very same document"""
def test_repeated_delivery_clears_only_once():
    controller, _, obs = build()

    controller.handle(at(10))
    controller.handle(at(10))

    assert obs.call_count == 1


"""Test an older timestamp is ignored, so an out-of-order snapshot cannot
re-blank the overlay over a legitimate new name"""
def test_older_request_is_ignored():
    controller, _, obs = build()

    controller.handle(at(10))
    assert controller.handle(at(5)) is False
    assert obs.call_count == 1


"""Test a genuinely newer request clears again"""
def test_newer_request_clears_again():
    controller, _, obs = build()

    controller.handle(at(10))
    assert controller.handle(at(20)) is True
    assert obs.call_count == 2


"""Test an empty control doc does nothing"""
def test_no_request_does_nothing():
    controller, _, obs = build()

    assert controller.handle(None) is False
    obs.assert_not_called()


"""Test priming at startup treats an existing request as already handled, so
an old clear is not replayed on every restart"""
def test_prime_suppresses_an_existing_request():
    controller, _, obs = build(last_request=at(10))

    controller.prime()

    assert controller.handle(at(10)) is False
    obs.assert_not_called()


"""Test priming still allows a request that arrives afterwards"""
def test_prime_does_not_block_later_requests():
    controller, _, obs = build(last_request=at(10))
    controller.prime()

    assert controller.handle(at(30)) is True
    obs.assert_called_once_with(DEFAULT_OBS_USERNAME)


"""Test a failure while priming leaves the controller willing to act, which is
the safe direction for a moderation control"""
def test_prime_failure_fails_open_towards_clearing():
    controller, store, obs = build()
    store.read_overlay_clear_request.side_effect = RuntimeError("unavailable")

    controller.prime()

    assert controller.handle(at(1)) is True


"""Test the poll path picks up a clear the snapshot stream missed"""
def test_check_now_acts_on_a_missed_request():
    controller, store, obs = build()
    store.read_overlay_clear_request.return_value = at(10)

    assert controller.check_now() is True
    obs.assert_called_once_with(DEFAULT_OBS_USERNAME)


"""Test the poll path does not re-clear what the listener already handled"""
def test_check_now_does_not_duplicate_the_listener():
    controller, store, obs = build()
    store.read_overlay_clear_request.return_value = at(10)

    controller.handle(at(10))
    assert controller.check_now() is False
    assert obs.call_count == 1


"""Test a Firestore outage during the poll is contained"""
def test_check_now_survives_a_store_error():
    controller, store, obs = build()
    store.read_overlay_clear_request.side_effect = RuntimeError("unavailable")

    assert controller.check_now() is False


"""Test a failing OBS callback does not raise into the listener thread"""
def test_obs_failure_is_contained():
    controller, _, obs = build()
    obs.side_effect = RuntimeError("socket gone")

    assert controller.handle(at(10)) is False


"""Test --no-obs (no callback wired) degrades quietly instead of crashing"""
def test_no_obs_callback_is_handled():
    controller = OverlayController(Mock(), None)

    assert controller.handle(at(10)) is False
