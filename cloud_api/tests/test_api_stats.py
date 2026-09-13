"""Route-level tests for GET /api/stats."""

from flask import Flask

from ..routes import register_routes
from shared.schema import STATS_DEFAULT_DAYS


def test_returns_the_aggregate_payload(client, mock_stats):
    response = client.get('/api/stats')

    assert response.status_code == 200
    assert response.get_json()['timezone'] == 'America/New_York'
    mock_stats.read_range.assert_called_once_with(STATS_DEFAULT_DAYS)


def test_days_can_be_narrowed(client, mock_stats):
    assert client.get('/api/stats?days=7').status_code == 200
    mock_stats.read_range.assert_called_once_with(7)


def test_response_is_cacheable(client):
    # Aggregates only move when the rollup command runs, so browsers and
    # the Cloudflare edge are allowed to hold onto this.
    assert 'max-age=300' in client.get('/api/stats').headers['Cache-Control']


def test_a_non_numeric_days_is_rejected(client, mock_stats):
    response = client.get('/api/stats?days=lots')

    assert response.status_code == 400
    mock_stats.read_range.assert_not_called()


def test_days_outside_the_allowed_window_is_rejected(client, mock_stats):
    assert client.get('/api/stats?days=0').status_code == 400
    assert client.get('/api/stats?days=91').status_code == 400
    assert client.get('/api/stats?days=-5').status_code == 400
    mock_stats.read_range.assert_not_called()


def test_a_store_failure_is_a_500_not_a_traceback(client, mock_stats):
    mock_stats.read_range.side_effect = RuntimeError('firestore is having a day')

    response = client.get('/api/stats')

    assert response.status_code == 500
    assert 'firestore' not in response.get_json()['error']


def test_stats_are_unavailable_rather_than_broken_without_a_store(mock_store):
    """An app built without a stats store still serves the rest of the API."""
    app = Flask(__name__)
    app.testing = True
    register_routes(app, mock_store)

    assert app.test_client().get('/api/stats').status_code == 503
    assert app.test_client().get('/api/queue').status_code == 200
