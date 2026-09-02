import hmac
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
    def enforce_auth():
        """Open health check or require the Worker API key."""
        # Open, so uptime checks need no secret.
        if request.path == '/':
            return None

        if request.path.startswith('/admin/'):
            return _require(Config.API_KEY, 'X-Api-Key', 'API_KEY')

        return _require(Config.API_KEY, 'X-Api-Key', 'API_KEY')

    def _require(configured, header, name):
        """Require a configured shared secret for non-admin API traffic."""
        if not configured:
            logger.error(f"{name} is not configured; rejecting request")
            return jsonify({'error': 'Server misconfigured'}), 500
        if not hmac.compare_digest(request.headers.get(header, ''), configured):
            return jsonify({'error': 'Unauthorized'}), 401
        return None


    register_routes(app, store)
    return app


if __name__ == '__main__':
    create_app().run(host='0.0.0.0', port=Config.PORT)
