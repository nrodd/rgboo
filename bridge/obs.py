"""
OBS Browser Source Integration
Provides routes and WebSocket handlers for OBS browser source functionality
"""

import logging
import time
from flask import render_template, request
from flask_socketio import emit

logger = logging.getLogger(__name__)

# Global variable for current username
current_obs_username = "Waiting for user..."

def setup_obs_routes(app, socketio):
    """Set up OBS routes and SocketIO handlers on the existing Flask app"""
    
    # OBS Browser Source route (local access only)
    @app.route('/obs')
    def obs_browser_source():
        """Serve the OBS browser source page - local access only"""
        # Only allow local access
        client_ip = request.environ.get('HTTP_X_FORWARDED_FOR', request.environ.get('REMOTE_ADDR', ''))
        if not (client_ip.startswith('127.0.0.1') or client_ip.startswith('::1') or client_ip.startswith('localhost') or client_ip == ''):
            logger.warning(f"Blocked external access to /obs from IP: {client_ip}")
            return "Access denied", 403
        
        return render_template('obs_browser_source.html', current_username=current_obs_username)

    # SocketIO event handlers for OBS (local access only)
    @socketio.on('connect')
    def handle_connect():
        # Only allow local WebSocket connections
        client_ip = request.environ.get('HTTP_X_FORWARDED_FOR', request.environ.get('REMOTE_ADDR', ''))
        if not (client_ip.startswith('127.0.0.1') or client_ip.startswith('::1') or client_ip.startswith('localhost') or client_ip == ''):
            logger.warning(f"Blocked external WebSocket connection from IP: {client_ip}")
            return False  # Reject connection
        
        logger.info(f"OBS browser source connected from {client_ip}")
        emit('current_username', {
            'username': current_obs_username,
            'timestamp': time.strftime('%H:%M:%S')
        })

    @socketio.on('disconnect')
    def handle_disconnect():
        logger.info("OBS browser source disconnected")

    @socketio.on('request_current_username')
    def handle_username_request():
        emit('current_username', {
            'username': current_obs_username,
            'timestamp': time.strftime('%H:%M:%S')
        })

def update_obs_username(username, socketio):
    """Update the username displayed in OBS"""
    global current_obs_username
    current_obs_username = username
    
    try:
        socketio.emit('username_update', {
            'username': username,
            'timestamp': time.strftime('%H:%M:%S')
        })
        logger.info(f"Broadcasted username update to OBS: {username}")
        return True
    except Exception as e:
        logger.error(f"Failed to broadcast username update: {e}")
        return False