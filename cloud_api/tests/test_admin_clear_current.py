from unittest.mock import Mock

from shared.schema import REDACTED_USERNAME

"""
Unit tests for POST /admin/clear-current (cloud_api/routes.py), the admin
action that pulls one user off the stream without touching anyone else's
queue. See docs/admin-clear-current.md.
"""


"""Test clearing blanks the overlay, cancels that user, and redacts the name"""
def test_clear_current_does_all_four_things(client, mock_store):
    response = client.post('/admin/clear-current', json={})

    assert response.status_code == 200
    body = response.get_json()
    assert body['cleared_username'] == "CurrentUser"
    assert body['cancelled_count'] == 2
    assert body['redacted_count'] == 3
    mock_store.cancel_pending_for_user.assert_called_once_with("CurrentUser")
    mock_store.redact_username.assert_called_once_with("CurrentUser")
    mock_store.request_overlay_clear.assert_called_once()


"""Test the overlay is only asked to blank after the queue is dealt with, so
the name cannot reappear in the gap"""
def test_overlay_cleared_after_the_queue_is_handled(client, mock_store):
    calls = []
    mock_store.cancel_pending_for_user.side_effect = lambda u: calls.append('cancel') or 2
    mock_store.redact_username.side_effect = lambda u: calls.append('redact') or 3
    mock_store.request_overlay_clear.side_effect = lambda: calls.append('overlay')

    client.post('/admin/clear-current', json={})

    assert calls == ['cancel', 'redact', 'overlay']


"""Test a specific username can be targeted after it has scrolled past"""
def test_explicit_username_is_used_instead_of_the_current_one(client, mock_store):
    response = client.post('/admin/clear-current', json={'username': 'ScrolledPast'})

    assert response.get_json()['cleared_username'] == 'ScrolledPast'
    mock_store.get_current_username.assert_not_called()
    mock_store.cancel_pending_for_user.assert_called_once_with('ScrolledPast')


"""Test nothing displayed is a success with zero counts, not an error"""
def test_nothing_displayed_succeeds_with_zero_counts(client, mock_store):
    mock_store.get_current_username.return_value = None

    response = client.post('/admin/clear-current', json={})

    assert response.status_code == 200
    body = response.get_json()
    assert body['cleared_username'] is None
    assert body['cancelled_count'] == 0
    mock_store.cancel_pending_for_user.assert_not_called()
    mock_store.request_overlay_clear.assert_not_called()


"""Test pressing it twice is harmless -- the store reports nothing current
once the top document is already redacted"""
def test_second_press_is_a_no_op(client, mock_store):
    mock_store.get_current_username.return_value = None

    response = client.post('/admin/clear-current', json={})

    assert response.status_code == 200
    assert response.get_json()['cleared_username'] is None


"""Test block: true adds the name to the denylist"""
def test_block_adds_to_the_denylist(client, mock_store):
    response = client.post('/admin/clear-current', json={'block': True})

    assert response.get_json()['blocked'] is True
    mock_store.block_username.assert_called_once_with("CurrentUser")


"""Test blocking is opt-in -- a plain clear does not deny the name"""
def test_block_is_opt_in(client, mock_store):
    response = client.post('/admin/clear-current', json={})

    assert response.get_json()['blocked'] is False
    mock_store.block_username.assert_not_called()


"""Test the name is captured before redaction, so the denylist gets the real
name rather than the redaction marker"""
def test_blocks_the_real_name_not_the_redaction_marker(client, mock_store):
    client.post('/admin/clear-current', json={'block': True})

    blocked = mock_store.block_username.call_args[0][0]
    assert blocked == "CurrentUser"
    assert blocked != REDACTED_USERNAME


"""Test an empty body is accepted -- the panic button sends no JSON"""
def test_empty_body_is_accepted(client, mock_store):
    response = client.post('/admin/clear-current')

    assert response.status_code == 200
    assert response.get_json()['cleared_username'] == "CurrentUser"


"""Test the response says whether the bridge is online, so the admin knows
if the overlay has actually changed yet"""
def test_reports_bridge_liveness(client, mock_store):
    mock_store.get_bridge_status.return_value = {
        'bridge_online': True, 'serial_connected': True, 'serial_port': '/dev/ttyUSB0'
    }

    response = client.post('/admin/clear-current', json={})

    assert response.get_json()['bridge_online'] is True


"""Test a store failure returns 500 rather than a stack trace"""
def test_store_failure_returns_500(client, mock_store):
    mock_store.cancel_pending_for_user.side_effect = RuntimeError("firestore down")

    response = client.post('/admin/clear-current', json={})

    assert response.status_code == 500
    assert response.get_json()['status'] == 'error'


"""Test a blocked username is rejected at submission, reusing the same code
the frontend already handles"""
def test_blocked_username_is_rejected_on_submit(client, mock_store):
    mock_store.is_blocked.return_value = True

    response = client.post('/api/color', json={
        'username': 'BlockedName', 'color': {'r': 1, 'g': 2, 'b': 3}
    })

    assert response.status_code == 400
    assert response.get_json()['code'] == 'PROFANITY_DETECTED'
    mock_store.add_request.assert_not_called()


"""Test an ordinary username is unaffected by the denylist check"""
def test_unblocked_username_still_queues(client, mock_store):
    response = client.post('/api/color', json={
        'username': 'fine', 'color': {'r': 1, 'g': 2, 'b': 3}
    })

    assert response.status_code == 200
    mock_store.add_request.assert_called_once()
