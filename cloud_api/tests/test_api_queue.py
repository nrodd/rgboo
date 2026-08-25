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
    resp = client.post('/api/queue/clear')
    assert resp.status_code == 200
    body = resp.get_json()
    assert body.get('status') == 'success'
    assert 'cleared_count' in body
