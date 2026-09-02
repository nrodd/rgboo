import hmac
import logging
from functools import lru_cache

import jwt

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
        """Open health check, Cloudflare Access admin identity, or Worker key."""
        # Open, so uptime checks need no secret.
        if request.path == '/':
            return None

        if request.path.startswith('/admin/'):
            return _require_access_admin()

        return _require(Config.API_KEY, 'X-Api-Key', 'API_KEY')

    def _require(configured, header, name):
        """Require a configured shared secret for non-admin API traffic."""
        if not configured:
            logger.error(f"{name} is not configured; rejecting request")
            return jsonify({'error': 'Server misconfigured'}), 500
        if not hmac.compare_digest(request.headers.get(header, ''), configured):
            return jsonify({'error': 'Unauthorized'}), 401
        return None

    @lru_cache(maxsize=1)
    def access_jwks():
        if not Config.ACCESS_TEAM_DOMAIN:
            return None
        return jwt.PyJWKClient(
            f'{Config.ACCESS_TEAM_DOMAIN}/cdn-cgi/access/certs'
        )

    def _require_access_admin():
        """Validate Cloudflare Access JWT and authorize its email claim."""
        if not Config.ACCESS_TEAM_DOMAIN or not Config.ACCESS_AUDIENCE or not Config.ADMIN_EMAILS:
            logger.error('Cloudflare Access admin authentication is not configured')
            return jsonify({'error': 'Server misconfigured'}), 500

        token = request.headers.get('Cf-Access-Jwt-Assertion')
        if not token:
            return jsonify({'error': 'Cloudflare Access authentication required'}), 401

        try:
            signing_key = access_jwks().get_signing_key_from_jwt(token)
            claims = jwt.decode(
                token,
                signing_key.key,
                algorithms=['RS256'],
                audience=Config.ACCESS_AUDIENCE,
                issuer=Config.ACCESS_TEAM_DOMAIN,
            )
        except Exception as error:
            logger.warning('Invalid Cloudflare Access JWT: %s', error)
            return jsonify({'error': 'Invalid Cloudflare Access authentication'}), 401

        email = claims.get('email')
        if not isinstance(email, str) or email.casefold() not in Config.ADMIN_EMAILS:
            logger.warning('Cloudflare Access user is not an admin')
            return jsonify({'error': 'Admin access required'}), 403
        return None

    register_routes(app, store)
    return app


if __name__ == '__main__':
    create_app().run(host='0.0.0.0', port=Config.PORT)
