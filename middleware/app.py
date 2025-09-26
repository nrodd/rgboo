from flask import Flask
from flask_cors import CORS
import logging
import atexit

from serial_controller import SerialController
from firmware_config import Config
from color_queue import ColorQueue
from routes import register_routes
from obs import OBSController

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

# Initialize OBS controller
obs_controller = OBSController()

# Initialize color queue with 20-second delay
color_queue = ColorQueue(serial_controller, obs_controller)
color_queue.start_worker()

# Register cleanup on app shutdown
def cleanup():
    color_queue.stop_worker()
    obs_controller.disconnect()

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
    
    # Try to connect to OBS on startup
    if obs_controller.connect():
        logger.info("Successfully connected to OBS WebSocket")
    else:
        logger.warning("Could not connect to OBS on startup - OBS integration will be disabled")
    
    # Start Flask app
    app.run(
        host=Config.HOST,
        port=Config.PORT,
        debug=Config.DEBUG
    )