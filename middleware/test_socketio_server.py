#!/usr/bin/env python3
"""
Standalone test for OBS WebSocket server
Run this to test if the SocketIO server works independently
"""

from flask import Flask
from flask_socketio import SocketIO, emit
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Create Flask app
app = Flask(__name__)
app.config['SECRET_KEY'] = 'test-secret'

# Create SocketIO
socketio = SocketIO(app, cors_allowed_origins="*", async_mode='threading')

@app.route('/')
def index():
    return '''
    <!DOCTYPE html>
    <html>
    <head>
        <title>Test SocketIO</title>
    </head>
    <body>
        <h1>SocketIO Test Page</h1>
        <p id="status">Connecting...</p>
        <script src="https://cdnjs.cloudflare.com/ajax/libs/socket.io/4.6.1/socket.io.js"></script>
        <script>
            const socket = io();
            socket.on('connect', function() {
                document.getElementById('status').innerText = 'Connected!';
                console.log('Connected to server');
            });
            socket.on('disconnect', function() {
                document.getElementById('status').innerText = 'Disconnected';
                console.log('Disconnected from server');
            });
        </script>
    </body>
    </html>
    '''

@socketio.on('connect')
def handle_connect():
    logger.info('Client connected')
    emit('message', {'data': 'Connected to test server'})

@socketio.on('disconnect')
def handle_disconnect():
    logger.info('Client disconnected')

if __name__ == '__main__':
    logger.info("Starting standalone SocketIO test server on port 5003...")
    try:
        socketio.run(app, host='0.0.0.0', port=5003, debug=False)
    except Exception as e:
        logger.error(f"Failed to start server: {e}")
        import traceback
        logger.error(f"Full traceback: {traceback.format_exc()}")