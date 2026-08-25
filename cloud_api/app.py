import hmac
import logging

from flask import Flask, jsonify, request

from .config import Config
from .firestore_client import get_firestore_client
from .routes import register_routes
from .store import RequestStore

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
)
logger = logging.getLogger(__name__)


def create_app(store=None) -> Flask:
    """Application factory.

    Pass `store` to inject a fake RequestStore in tests. Production
    (gunicorn's `--factory` loader, see Dockerfile) calls this with no
    arguments, which builds a real Firestore-backed store -- and its
    client -- here, at worker boot, rather than at import time. That
    keeps `import cloud_api.app` side-effect-free, so it never needs
    live GCP credentials just to be imported (e.g. by tests or tooling).
    """
    app = Flask(__name__)

    if store is None:
        store = RequestStore(get_firestore_client())

    @app.before_request
    def enforce_api_key():
        # Health check stays open so uptime checks don't need the secret.
        if request.path == '/':
            return None
        if not Config.API_KEY:
            logger.error("API_KEY is not configured; rejecting request")
            return jsonify({'error': 'Server misconfigured'}), 500
        supplied = request.headers.get('X-Api-Key', '')
        if not hmac.compare_digest(supplied, Config.API_KEY):
            return jsonify({'error': 'Unauthorized'}), 401

    register_routes(app, store)
    return app


if __name__ == '__main__':
    create_app().run(host='0.0.0.0', port=Config.PORT)
