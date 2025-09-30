from flask import request, jsonify
from datetime import datetime
import logging
from color_queue import timer
from database import get_request_database
from better_profanity import profanity

logger = logging.getLogger(__name__)

# Initialize profanity filter
profanity.load_censor_words()

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
            
            # Check username for profanity
            if profanity.contains_profanity(username):
                logger.warning(f"Profanity detected in username: '{username}'")
                return jsonify({
                    'error': 'Username contains inappropriate language. Please choose a different username.',
                    'code': 'PROFANITY_DETECTED'
                }), 400
            
            # Validate color format
            if not all(key in color for key in ['r', 'g', 'b']):
                return jsonify({'error': 'Color must have r, g, b values'}), 400
            
            # Validate color values (0-255)
            for component in ['r', 'g', 'b']:
                if not isinstance(color[component], int) or not (0 <= color[component] <= 255):
                    return jsonify({'error': f'Color {component} must be integer between 0-255'}), 400
            
            # Log the request
            logger.info(f"Color change request from user '{username}': RGB({color['r']}, {color['g']}, {color['b']})")
            
            # Add color request to queue with proper timing
            color_request = color_queue.add_request(username, color['r'], color['g'], color['b'])
            
            # Log request to database
            try:
                db = get_request_database()
                db_id = db.log_request(username, color['r'], color['g'], color['b'])
                logger.debug(f"Request logged to database with ID: {db_id}")
            except Exception as db_error:
                logger.error(f"Failed to log request to database: {db_error}")
                # Don't fail the request if database logging fails
            
            response = {
                'status': 'queued',
                'message': f'Color request queued successfully - Position {color_request["queue_position"]} in queue, estimated wait: {color_request["estimated_wait_seconds"]} seconds',
                'username': username,
                'color': color,
                'request_id': color_request['request_id'],
                'queue_position': color_request['queue_position'],
                'estimated_wait_seconds': color_request['estimated_wait_seconds'],
                'scheduled_time': color_request['scheduled_time'].isoformat(),
                'timestamp': datetime.now().isoformat()
            }
            logger.info(f"Successfully queued color request for user '{username}' (ID: {color_request['request_id']}) - Position: {color_request['queue_position']}, Wait: {color_request['estimated_wait_seconds']}s")
            return jsonify(response), 200
                
        except Exception as e:
            logger.error(f"Error processing color request: {str(e)}")
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
        status = color_queue.get_queue_status()
        status['queue_contents'] = color_queue.get_queue_contents()
        return jsonify(status)

    @app.route('/api/queue/clear', methods=['POST'])
    def clear_queue():
        """Clear all pending requests from the queue"""
        cleared_count = color_queue.clear_queue()
        return jsonify({
            'status': 'success',
            'message': f'Cleared {cleared_count} requests from queue',
            'cleared_count': cleared_count
        })

    @app.errorhandler(404)
    def not_found(error):
        return jsonify({'error': 'Endpoint not found'}), 404

    @app.errorhandler(500)
    def internal_error(error):
        return jsonify({'error': 'Internal server error'}), 500