import pytest

"""
Unit tests for the RGBoo Cloud API
/api/color
"""

"""Test valid"""
def test_valid(client):
  data = {
    "username": "Jack Skellington",
    "color": {
      "r": 255,
      "g": 128,
      "b": 64
    }
  }

  response = client.post('/api/color', json=data, headers={'Content-Type': 'application/json'})
  assert response.status_code == 200

"""Test color > 255"""
def test_color_invalid_value_positive(client):
  data = {
    "username": "Jack Skellington",
    "color": {
      "r": 300,
      "g": 128,
      "b": 64
    }
  }

  response = client.post('/api/color', json=data, headers={'Content-Type': 'application/json'})
  assert response.status_code == 400

"""Test color < 0"""
def test_color_invalid_value_negative(client):
  data = {
    "username": "Jack Skellington",
    "color": {
      "r": -10,
      "g": 128,
      "b": 64
    }
  }

  response = client.post('/api/color', json=data, headers={'Content-Type': 'application/json'})
  assert response.status_code == 400

"""Test missing username"""
def test_username_missing(client):
  data = {
    "color": {
      "r": 255,
      "g": 128,
      "b": 64
    }
  }

  response = client.post('/api/color', json=data, headers={'Content-Type': 'application/json'})
  assert response.status_code == 400

"""Test profanity in username"""
@pytest.mark.parametrize("username, expected_status", [
  ("Jack Skellington", 200),
  ("Sally", 200),
  ("bob123", 200),
  ("", 200),
  ("a", 200),
  ("stream_fan", 200),

  ("hell", 400),
  ("f*cking_gamer", 400),
  ("sh*t_user", 400),
])
def test_username_profanity(client, username, expected_status):

  data = {
    "username": username,
    "color": {
      "r": 255,
      "g": 128,
      "b": 64
    }
  }

  response = client.post('/api/color', json=data, headers={'Content-Type': 'application/json'})
  assert response.status_code == expected_status
