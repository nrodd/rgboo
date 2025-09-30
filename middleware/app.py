from flask import Flask
from flask_cors import CORS
from flask_socketio import SocketIO
import logging
import atexit
import os

from serial_controller import SerialController
from firmware_config import Config
from color_queue import ColorQueue
from routes import register_routes
from obs import setup_obs_routes, update_obs_username
from database import init_request_database

# Initialize Flask app
app = Flask(__name__)
CORS(app)  # Enable CORS for web frontend
app.config['SECRET_KEY'] = 'obs-websocket-secret'

# Initialize SocketIO with proper CORS for external access
socketio = SocketIO(app, cors_allowed_origins="*", async_mode='threading', 
                   allow_upgrades=True, logger=True, engineio_logger=True)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('middleware.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# Initialize database
logger.info("Initializing request database...")
request_db = init_request_database()

# Initialize serial controller
serial_controller = SerialController()

# Function wrapper for OBS update callback
def obs_update_callback(username):
    """Wrapper function to call OBS update with socketio instance"""
    return update_obs_username(username, socketio)

# Initialize color queue with 20-second delay (with OBS update callback)
color_queue = ColorQueue(serial_controller, obs_update_callback)
color_queue.start_worker()

# Setup OBS routes and handlers
setup_obs_routes(app, socketio)

# Register cleanup on app shutdown
def cleanup():
    color_queue.stop_worker()

atexit.register(cleanup)

# Register API routes
register_routes(app, serial_controller, color_queue)

if __name__ == '__main__':
    logger.info("Starting RGB Controller Middleware API...")

    # Try to connect to ESP32 on startup
    if serial_controller.connect():
        logger.info("Successfully connected to ESP32")
    else:
        logger.warning("Could not connect to ESP32 on startup - will retry on first request")

    logger.info(f"OBS Browser Source available at http://{Config.HOST}:{Config.PORT}/obs")

    # Start Flask app with SocketIO
    socketio.run(
        app,
        host=Config.HOST,
        port=Config.PORT,
        debug=Config.DEBUG,
        use_reloader=False
    )