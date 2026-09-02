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
        """Open health check, admin key, or the Worker key.

        /admin/* does not accept API_KEY: the Worker sends that on everything
        it proxies, so it means "came via rgboo.com", not "is an admin".
        """
        # Preflight requests do not carry the custom admin header. They only
        # negotiate whether the browser may send the subsequent request.
        if request.method == 'OPTIONS':
            return None

        # Open, so uptime checks need no secret.
        if request.path == '/':
            return None

        if request.path.startswith('/admin/'):
            return _require(Config.ADMIN_KEY, 'X-Admin-Key', 'ADMIN_KEY')

        return _require(Config.API_KEY, 'X-Api-Key', 'API_KEY')

    @app.after_request
    def add_cors_headers(response):
        """Allow the separately hosted admin page to call the API."""
        origin = request.headers.get('Origin')
        if origin in {'https://rgboo.com', 'http://localhost:5173'}:
            response.headers['Access-Control-Allow-Origin'] = origin
            response.headers['Access-Control-Allow-Headers'] = 'Content-Type, X-Admin-Key, X-Api-Key'
            response.headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS'
            response.headers['Vary'] = 'Origin'
        return response

    def _require(configured, header, name):
        """Constant-time header check. Fails closed when unconfigured."""
        if not configured:
            # Fail closed: never fall through, never accept the other key.
            logger.error(f"{name} is not configured; rejecting request")
            return jsonify({'error': 'Server misconfigured'}), 500
        if not hmac.compare_digest(request.headers.get(header, ''), configured):
            return jsonify({'error': 'Unauthorized'}), 401
        return None

    register_routes(app, store)
    return app


if __name__ == '__main__':
    create_app().run(host='0.0.0.0', port=Config.PORT)
