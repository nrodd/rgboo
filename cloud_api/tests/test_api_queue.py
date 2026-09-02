"""
Unit tests for the RGBoo Cloud API
/queue
"""

"""Test initial"""
def test_queue_initial(client):
    resp = client.get('/api/queue')
    assert resp.status_code == 200
    data = resp.get_json()
    assert 'queue_size' in data
    assert 'worker_running' in data
    assert 'next_available_slot' in data

"""Test request queued"""
def test_enqueue_via_api_and_status(client):
    payload = {
        "username": "Jack Skellington",
        "color": {"r": 10, "g": 20, "b": 30}
    }

    resp = client.post('/api/color', json=payload, headers={'Content-Type': 'application/json'})
    assert resp.status_code == 200
    body = resp.get_json()
    assert body['status'] == 'queued'
    assert 'queue_position' in body
    assert 'estimated_wait_seconds' in body
    assert 'request_id' in body

    # After enqueue, GET /api/queue should still succeed and include queue_contents
    qresp = client.get('/api/queue')
    assert qresp.status_code == 200
    qdata = qresp.get_json()
    assert 'queue_contents' in qdata

"""Test queue cleared"""
def test_clear_queue(client):
    resp = client.post('/admin/queue/clear')
    assert resp.status_code == 200
    body = resp.get_json()
    assert body.get('status') == 'success'
    assert 'cleared_count' in body


def test_admin_status_returns_current_and_first_ten(client, mock_store):
    mock_store.get_current_username.return_value = 'On Screen'
    mock_store.get_queue_contents.return_value = [
        {'username': 'Next', 'queue_position': 1}
    ]
    response = client.get('/admin/status')

    assert response.status_code == 200
    assert response.get_json()['current_username'] == 'On Screen'
    assert response.get_json()['queue'][0]['username'] == 'Next'
    mock_store.get_queue_contents.assert_called_once_with(limit=10)


def test_remove_queue_user_requires_username(client, mock_store):
    response = client.post('/admin/queue/remove', json={})

    assert response.status_code == 400
    mock_store.cancel_request.assert_not_called()


def test_remove_queue_request_cancels_one_request(client, mock_store):
    mock_store.cancel_request.return_value = 1
    response = client.post('/admin/queue/remove', json={'request_id': 'request-123'})

    assert response.status_code == 200
    assert response.get_json()['cancelled_count'] == 1
    mock_store.cancel_request.assert_called_once_with('request-123')
