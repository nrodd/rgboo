import queue
import threading
import time
import logging
from datetime import datetime, timedelta
from obs import update_obs_text

logger = logging.getLogger(__name__)

timer = 20

class ColorQueue:
    """Simple queue for color requests with 20-second delay"""
    
    def __init__(self, serial_controller):
        self.serial_controller = serial_controller
        self.request_queue = queue.Queue()
        self.worker_thread = None
        self.running = False
    
    def start_worker(self):
        """Start the background worker thread"""
        self.running = True
        self.worker_thread = threading.Thread(target=self._worker_loop, daemon=True)
        self.worker_thread.start()
        logger.info("Color queue worker started")
    
    def stop_worker(self):
        """Stop the background worker thread"""
        self.running = False
    
    def add_request(self, username: str, r: int, g: int, b: int) -> str:
        """Add a color request to the queue"""
        request_id = f"{username}_{int(time.time())}"
        scheduled_time = datetime.now() + timedelta(seconds=timer)
        
        color_request = {
            'username': username,
            'r': r,
            'g': g,
            'b': b,
            'request_id': request_id,
            'scheduled_time': scheduled_time
        }
        
        self.request_queue.put(color_request)
        logger.info(f"Queued color request from {username}: RGB({r}, {g}, {b})")
        
        return request_id
    
    def get_queue_status(self):
        """Get current queue status"""
        return {
            'queue_size': self.request_queue.qsize(),
            'worker_running': self.running
        }
    
    def _worker_loop(self):
        """Background worker that processes the queue"""
        while self.running:
            try:
                # Get a request from the queue
                color_request = self.request_queue.get(timeout=1.0)
                
                # Wait until it's time to process
                while datetime.now() < color_request['scheduled_time']:
                    time.sleep(0.5)
                
                # Send color to ESP32
                success, message = self.serial_controller.send_color(
                    color_request['r'], 
                    color_request['g'], 
                    color_request['b']
                )
                
                if success:
                    logger.info(f"Sent color to ESP32 for {color_request['username']}")
                    
                    # Send username to OBS
                    try:
                        obs_success = update_obs_text("CurrentUser", color_request['username'])
                        if obs_success:
                            logger.info(f"Updated OBS with username: {color_request['username']}")
                        else:
                            logger.warning(f"Failed to update OBS with username: {color_request['username']}")
                    except Exception as obs_error:
                        logger.error(f"Error updating OBS: {obs_error}")
                        
                else:
                    logger.error(f"Failed to send color: {message}")
                    
            except queue.Empty:
                continue
            except Exception as e:
                logger.error(f"Error in queue worker: {e}")
    
    def clear_queue(self) -> int:
        """Clear all pending requests"""
        cleared_count = 0
        while not self.request_queue.empty():
            try:
                self.request_queue.get_nowait()
                cleared_count += 1
            except queue.Empty:
                break
        
        logger.info(f"Cleared {cleared_count} requests from queue")
        return cleared_count