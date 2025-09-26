from obswebsocket import obsws, requests
import logging

logger = logging.getLogger(__name__)

class OBSController:
    """Simple OBS WebSocket controller for updating text sources"""
    
    def __init__(self, host: str = "localhost", port: int = 4455, password: str = "yourpassword"):
        self.host = host
        self.port = port
        self.password = password
        self.ws = None
        self.connected = False
    
    def connect(self) -> bool:
        """Connect to OBS WebSocket"""
        try:
            self.ws = obsws(self.host, self.port, self.password)
            self.ws.connect()
            self.connected = True
            return True
        except Exception as e:
            logger.error(f"Failed to connect to OBS: {e}")
            return False
    
    def disconnect(self):
        """Disconnect from OBS WebSocket"""
        if self.ws and self.connected:
            try:
                self.ws.disconnect()
                self.connected = False
            except Exception as e:
                logger.error(f"Error disconnecting from OBS: {e}")
    
    def update_text(self, source_name: str, text: str) -> bool:
        """Update a text source in OBS"""
        if not self.connected:
            return False
        
        try:
            self.ws.call(requests.SetInputSettings(
                inputName=source_name,
                inputSettings={"text": text},
                overlay=True
            ))
            return True
        except Exception as e:
            logger.error(f"Failed to update text source '{source_name}': {e}")
            return False

# Simple convenience function
def update_obs_text(source_name: str, text: str, host: str = "localhost", port: int = 4455, password: str = "yourpassword") -> bool:
    """
    Update OBS text source (connects, updates, disconnects)
    
    Args:
        source_name: Name of the text source in OBS
        text: New text content
        host: OBS host (default: localhost)
        port: OBS port (default: 4455)
        password: OBS password
        
    Returns:
        bool: True if successful, False otherwise
    """
    obs = OBSController(host, port, password)
    if obs.connect():
        result = obs.update_text(source_name, text)
        obs.disconnect()
        return result
    return False

# Example usage
if __name__ == "__main__":
    # Quick text update
    update_obs_text("SongTitle", "Now Playing: Spooky Music")
