from flask import Flask
from flask_cors import CORS
import logging
import atexit

from serial_controller import SerialController
from firmware_config import Config
from color_queue import ColorQueue
from routes import register_routes
from obs import start_obs_server, stop_obs_server

# Initialize Flask app
app = Flask(__name__)
CORS(app)  # Enable CORS for web frontend

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

# Initialize serial controller
serial_controller = SerialController()

# Start OBS WebSocket server
start_obs_server()

# Initialize color queue with 20-second delay (no OBS controller needed)
color_queue = ColorQueue(serial_controller)
color_queue.start_worker()

# Register cleanup on app shutdown
def cleanup():
    color_queue.stop_worker()
    stop_obs_server()

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
    
    # OBS WebSocket server starts automatically
    logger.info("OBS WebSocket server started - Browser Source available at http://localhost:5002")
    
    # Start Flask app
    app.run(
        host=Config.HOST,
        port=Config.PORT,
        debug=Config.DEBUG
    )