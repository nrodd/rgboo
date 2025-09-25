from flask import request, jsonify
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

def register_routes(app, serial_controller, color_queue):
    """Register all API routes with the Flask app"""
    
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
            
            # Add color request to queue (20-second delay)
            request_id = color_queue.add_request(username, color['r'], color['g'], color['b'])
            
            response = {
                'status': 'queued',
                'message': 'Color request queued successfully - will be sent in 20 seconds',
                'username': username,
                'color': color,
                'request_id': request_id,
                'scheduled_time': (datetime.now().replace(microsecond=0) + 
                                 __import__('datetime').timedelta(seconds=20)).isoformat(),
                'timestamp': datetime.now().isoformat()
            }
            logger.info(f"Successfully queued color request for user '{username}' (ID: {request_id})")
            return jsonify(response), 200
                
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
            
            # Add color request to queue (20-second delay)
            request_id = color_queue.add_request(username, r, g, b)
            
            response = {
                'status': 'queued',
                'message': 'Color request queued successfully - will be sent in 20 seconds',
                'username': username,
                'hex': data['hex'],
                'rgb': {'r': r, 'g': g, 'b': b},
                'request_id': request_id,
                'scheduled_time': (datetime.now().replace(microsecond=0) + 
                                 __import__('datetime').timedelta(seconds=20)).isoformat(),
                'timestamp': datetime.now().isoformat()
            }
            return jsonify(response), 200
                
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
            'available_ports': serial_controller.get_available_ports(),
            'queue_status': color_queue.get_queue_status()
        })

    @app.route('/api/queue', methods=['GET'])
    def get_queue_status():
        """Get detailed queue status"""
        return jsonify(color_queue.get_queue_status())

    @app.route('/api/queue/clear', methods=['POST'])
    def clear_queue():
        """Clear all pending requests from the queue"""
        cleared_count = color_queue.clear_queue()
        return jsonify({
            'status': 'success',
            'message': f'Cleared {cleared_count} requests from queue',
            'cleared_count': cleared_count,
            'timestamp': datetime.now().isoformat()
        })

    @app.errorhandler(404)
    def not_found(error):
        return jsonify({'error': 'Endpoint not found'}), 404

    @app.errorhandler(500)
    def internal_error(error):
        return jsonify({'error': 'Internal server error'}), 500