"""The local OBS browser source, served by the bridge on :5001.

Deliberately thin: the routes, SocketIO handlers, local-IP-only check and
the HTML template are imported from middleware/obs.py and
middleware/templates/ unchanged, so the OBS scene needs no edits at
cutover. Phase 6 of the migration moves those two files into bridge/ when
middleware/ is retired.
"""

import logging
import threading
from pathlib import Path

import middleware
from flask import Flask
from flask_socketio import SocketIO
from middleware.obs import setup_obs_routes, update_obs_username

logger = logging.getLogger(__name__)

# Resolved from the middleware package rather than hardcoded, so it keeps
# working when that directory moves.
TEMPLATE_DIR = Path(middleware.__file__).resolve().parent / 'templates'


def create_obs_app(secret_key: str):
    """Build the Flask + SocketIO app serving /obs."""
    app = Flask(__name__, template_folder=str(TEMPLATE_DIR))
    app.config['SECRET_KEY'] = secret_key

    socketio = SocketIO(app, cors_allowed_origins="*", async_mode='threading')
    setup_obs_routes(app, socketio)
    return app, socketio


def make_obs_callback(socketio):
    """Callback the processor calls with each dispatched username."""
    def obs_update_callback(username: str) -> bool:
        return update_obs_username(username, socketio)

    return obs_update_callback


def start_obs_server(app, socketio, host: str, port: int) -> threading.Thread:
    """Serve /obs on a daemon thread so the main thread can dispatch colors."""
    def serve():
        try:
            socketio.run(
                app,
                host=host,
                port=port,
                debug=False,
                use_reloader=False,
                # Werkzeug needs this outside debug. Same local-only server
                # the middleware ran; reachable from this machine only.
                allow_unsafe_werkzeug=True,
            )
        except TypeError:
            # Older Flask-SocketIO has no allow_unsafe_werkzeug argument.
            socketio.run(app, host=host, port=port, debug=False, use_reloader=False)
        except Exception as e:
            logger.error(f"OBS server stopped: {e}")

    thread = threading.Thread(target=serve, name='obs-server', daemon=True)
    thread.start()
    logger.info(f"OBS Browser Source available at http://{host}:{port}/obs")
    return thread
