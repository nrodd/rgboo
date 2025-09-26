"""
OBS Browser Source WebSocket Server
Serves HTML page with real-time username updates via WebSocket
"""

import logging
from flask import Flask, render_template
from flask_socketio import SocketIO, emit
import threading
import time

logger = logging.getLogger(__name__)

class OBSWebSocketServer:
    """WebSocket server for OBS browser source integration"""
    
    def __init__(self, port=5002):
        self.port = port
        self.app = None
        self.socketio = None
        self.server_thread = None
        self.current_username = "Waiting for user..."
        self.running = False
        
    def create_app(self):
        """Create Flask app with SocketIO"""
        app = Flask(__name__)
        app.config['SECRET_KEY'] = 'obs-websocket-secret'
        
        @app.route('/')
        def obs_page():
            """Serve the OBS browser source page"""
            return render_template('obs_browser_source.html', current_username=self.current_username)
        
        return app
    
    def start_server(self):
        """Start the WebSocket server in a separate thread"""
        if self.running:
            logger.warning("OBS WebSocket server already running")
            return
        
        try:
            self.app = self.create_app()
            self.socketio = SocketIO(self.app, cors_allowed_origins="*", async_mode='eventlet')
            
            # WebSocket event handlers
            @self.socketio.on('connect')
            def handle_connect(auth):
                from flask import request
                logger.info(f"OBS browser source connected from {request.remote_addr}")
                emit('current_username', {
                    'username': self.current_username,
                    'timestamp': time.strftime('%H:%M:%S')
                })
            
            @self.socketio.on('disconnect')
            def handle_disconnect():
                logger.info("OBS browser source disconnected")
            
            @self.socketio.on('request_current_username')
            def handle_username_request():
                emit('current_username', {
                    'username': self.current_username,
                    'timestamp': time.strftime('%H:%M:%S')
                })
            
            # Start server in background thread
            self.server_thread = threading.Thread(
                target=self._run_server,
                daemon=True
            )
            self.running = True
            self.server_thread.start()
            
            logger.info(f"OBS WebSocket server started on port {self.port}")
            logger.info(f"OBS Browser Source URL: http://localhost:{self.port}")
            
        except Exception as e:
            logger.error(f"Failed to start OBS WebSocket server: {e}")
            self.running = False
    
    def _run_server(self):
        """Internal method to run the server"""
        try:
            self.socketio.run(self.app, host='0.0.0.0', port=self.port, debug=False)
        except Exception as e:
            logger.error(f"OBS WebSocket server error: {e}")
            self.running = False
    
    def stop_server(self):
        """Stop the WebSocket server"""
        self.running = False
        if self.socketio:
            self.socketio.stop()
        logger.info("OBS WebSocket server stopped")
    
    def update_username(self, username):
        """Update the current username and broadcast to all connected clients"""
        self.current_username = username
        
        if self.socketio and self.running:
            try:
                self.socketio.emit('username_update', {
                    'username': username,
                    'timestamp': time.strftime('%H:%M:%S')
                })
                logger.info(f"Broadcasted username update to OBS: {username}")
                return True
            except Exception as e:
                logger.error(f"Failed to broadcast username update: {e}")
                return False
        else:
            logger.warning("OBS WebSocket server not running, cannot update username")
            return False
    
    def is_running(self):
        """Check if the server is running"""
        return self.running

# Global OBS WebSocket server instance
obs_websocket_server = OBSWebSocketServer()

def start_obs_server():
    """Start the OBS WebSocket server"""
    obs_websocket_server.start_server()

def stop_obs_server():
    """Stop the OBS WebSocket server"""
    obs_websocket_server.stop_server()

def update_obs_username(username):
    """Update the username displayed in OBS"""
    return obs_websocket_server.update_username(username)

def is_obs_server_running():
    """Check if OBS server is running"""
    return obs_websocket_server.is_running()