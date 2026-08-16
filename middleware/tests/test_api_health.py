"""
Unit tests for the RGB Controller Middleware API
If these tests fail, something is terribly wrong
"""

"""Test the health check endpoint"""
def test_health_check(client):
    response = client.get('/')
    assert response.status_code == 200

"""Test the status endpoint"""
def test_status_endpoint(client):
  response = client.get('/api/status')
  assert response.status_code == 200