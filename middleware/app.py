from flask import Flask, request, jsonify
from flask_cors import CORS
import logging
from datetime import datetime
import os

from serial_controller import SerialController
from config import Config

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

@app.route('/', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'service': 'RGB Controller Middleware',
        'timestamp': datetime.now().isoformat(),
        'serial_connected': serial_controller.is_connected()
    })

@app.route('/api/color', methods=['POST'])
def set_color():
    """
    Main API endpoint to set RGB color
    Expected JSON payload:
    {
        "username": "string",
        "color": {
            "r": 255,
            "g": 128,
            "b": 64
        }
    }
    """
    try:
        # Validate request
        if not request.is_json:
            return jsonify({'error': 'Request must be JSON'}), 400
        
        data = request.get_json()
        
        # Validate required fields
        if 'username' not in data:
            return jsonify({'error': 'Username is required'}), 400
        
        if 'color' not in data:
            return jsonify({'error': 'Color is required'}), 400
        
        color = data['color']
        username = data['username']
        
        # Validate color format
        if not all(key in color for key in ['r', 'g', 'b']):
            return jsonify({'error': 'Color must have r, g, b values'}), 400
        
        # Validate color values (0-255)
        for component in ['r', 'g', 'b']:
            if not isinstance(color[component], int) or not (0 <= color[component] <= 255):
                return jsonify({'error': f'Color {component} must be integer between 0-255'}), 400
        
        # Log the request
        logger.info(f"Color change request from user '{username}': RGB({color['r']}, {color['g']}, {color['b']})")
        
        # Send color to ESP32
        success, message = serial_controller.send_color(color['r'], color['g'], color['b'])
        
        if success:
            response = {
                'status': 'success',
                'message': 'Color sent successfully',
                'username': username,
                'color': color,
                'timestamp': datetime.now().isoformat()
            }
            logger.info(f"Successfully sent color to ESP32 for user '{username}'")
            return jsonify(response), 200
        else:
            logger.error(f"Failed to send color to ESP32: {message}")
            return jsonify({
                'status': 'error',
                'message': f'Failed to send color: {message}',
                'timestamp': datetime.now().isoformat()
            }), 500
            
    except Exception as e:
        logger.error(f"Error processing color request: {str(e)}")
        return jsonify({
            'status': 'error',
            'message': 'Internal server error',
            'timestamp': datetime.now().isoformat()
        }), 500

@app.route('/api/color/hex', methods=['POST'])
def set_color_hex():
    """
    Alternative endpoint to set color using hex format
    Expected JSON payload:
    {
        "username": "string",
        "hex": "#FF8040"
    }
    """
    try:
        if not request.is_json:
            return jsonify({'error': 'Request must be JSON'}), 400
        
        data = request.get_json()
        
        # Validate required fields
        if 'username' not in data or 'hex' not in data:
            return jsonify({'error': 'Username and hex color are required'}), 400
        
        hex_color = data['hex']
        username = data['username']
        
        # Validate hex format
        if not hex_color.startswith('#') or len(hex_color) != 7:
            return jsonify({'error': 'Hex color must be in format #RRGGBB'}), 400
        
        try:
            # Convert hex to RGB
            hex_color = hex_color.lstrip('#')
            r = int(hex_color[0:2], 16)
            g = int(hex_color[2:4], 16)
            b = int(hex_color[4:6], 16)
        except ValueError:
            return jsonify({'error': 'Invalid hex color format'}), 400
        
        logger.info(f"Hex color change request from user '{username}': {data['hex']} -> RGB({r}, {g}, {b})")
        
        # Send color to ESP32
        success, message = serial_controller.send_color_hex(data['hex'])
        
        if success:
            response = {
                'status': 'success',
                'message': 'Color sent successfully',
                'username': username,
                'hex': data['hex'],
                'rgb': {'r': r, 'g': g, 'b': b},
                'timestamp': datetime.now().isoformat()
            }
            return jsonify(response), 200
        else:
            logger.error(f"Failed to send hex color to ESP32: {message}")
            return jsonify({
                'status': 'error',
                'message': f'Failed to send color: {message}',
                'timestamp': datetime.now().isoformat()
            }), 500
            
    except Exception as e:
        logger.error(f"Error processing hex color request: {str(e)}")
        return jsonify({
            'status': 'error',
            'message': 'Internal server error',
            'timestamp': datetime.now().isoformat()
        }), 500

@app.route('/api/status', methods=['GET'])
def get_status():
    """Get current system status"""
    return jsonify({
        'serial_connected': serial_controller.is_connected(),
        'serial_port': serial_controller.get_port_info(),
        'uptime': datetime.now().isoformat(),
        'available_ports': serial_controller.get_available_ports()
    })

@app.errorhandler(404)
def not_found(error):
    return jsonify({'error': 'Endpoint not found'}), 404

@app.errorhandler(500)
def internal_error(error):
    return jsonify({'error': 'Internal server error'}), 500

if __name__ == '__main__':
    logger.info("Starting RGB Controller Middleware API...")
    
    # Try to connect to ESP32 on startup
    if serial_controller.connect():
        logger.info("Successfully connected to ESP32")
    else:
        logger.warning("Could not connect to ESP32 on startup - will retry on first request")
    
    # Start Flask app
    app.run(
        host=Config.HOST,
        port=Config.PORT,
        debug=Config.DEBUG
    )