import queue
import threading
import time
import logging
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)

timer = 20

class ColorQueue:
    """Simple queue for color requests with 20-second delay"""
    
    def __init__(self, serial_controller, obs_update_callback=None):
        self.serial_controller = serial_controller
        self.request_queue = queue.Queue()
        self.worker_thread = None
        self.running = False
        self.obs_update_callback = obs_update_callback
        self.last_scheduled_time = datetime.now()
        self._lock = threading.Lock()  # For thread-safe access to last_scheduled_time
    
    def start_worker(self):
        """Start the background worker thread"""
        self.running = True
        # Reset timing when starting
        with self._lock:
            self.last_scheduled_time = datetime.now()
        self.worker_thread = threading.Thread(target=self._worker_loop, daemon=True)
        self.worker_thread.start()
        logger.info("Color queue worker started")
    
    def stop_worker(self):
        """Stop the background worker thread"""
        self.running = False
    
    def add_request(self, username: str, r: int, g: int, b: int) -> dict:
        """Add a color request to the queue"""
        request_id = f"{username}_{int(time.time())}"
        
        with self._lock:
            # Calculate the next available slot
            now = datetime.now()
            # If last scheduled time is in the past, start from now
            if self.last_scheduled_time <= now:
                scheduled_time = now + timedelta(seconds=timer)
            else:
                # Schedule after the last request
                scheduled_time = self.last_scheduled_time + timedelta(seconds=timer)
            
            self.last_scheduled_time = scheduled_time
            queue_position = self.request_queue.qsize() + 1
            estimated_wait = int((scheduled_time - now).total_seconds())
        
        color_request = {
            'username': username,
            'r': r,
            'g': g,
            'b': b,
            'request_id': request_id,
            'scheduled_time': scheduled_time,
            'queue_position': queue_position,
            'estimated_wait_seconds': estimated_wait
        }
        
        self.request_queue.put(color_request)
        logger.info(f"Queued color request from {username}: RGB({r}, {g}, {b}) - Position: {queue_position}, Wait: {estimated_wait}s")
        
        return color_request
    
    def get_queue_status(self):
        """Get current queue status"""
        with self._lock:
            next_available_time = max(self.last_scheduled_time, datetime.now())
            return {
                'queue_size': self.request_queue.qsize(),
                'worker_running': self.running,
                'next_available_slot': next_available_time.isoformat(),
                'estimated_wait_for_new_request': int((next_available_time - datetime.now()).total_seconds()) + timer
            }
    
    def _worker_loop(self):
        """Background worker that processes the queue"""
        logger.info("Queue worker loop started")
        while self.running:
            try:
                # Get a request from the queue
                color_request = self.request_queue.get(timeout=1.0)
                
                username = color_request['username']
                scheduled_time = color_request['scheduled_time']
                now = datetime.now()
                
                logger.debug(f"Processing request for {username}, scheduled for {scheduled_time}, current time: {now}")
                
                # Wait until it's time to process
                if now < scheduled_time:
                    wait_seconds = (scheduled_time - now).total_seconds()
                    logger.info(f"Waiting {wait_seconds:.1f} seconds before processing {username}'s request")
                    while datetime.now() < scheduled_time:
                        if not self.running:  # Check if we should stop
                            return
                        time.sleep(0.5)
                
                logger.info(f"Processing color request for {username} at {datetime.now()}")
                
                # Send color to ESP32
                success, message = self.serial_controller.send_color(
                    color_request['r'], 
                    color_request['g'], 
                    color_request['b']
                )

                if success:
                    logger.info(f"SUCCESS: Sent color RGB({color_request['r']}, {color_request['g']}, {color_request['b']}) to ESP32 for {username}")
                else:
                    logger.error(f"ERROR: Failed to send color for {username}: {message}")

                # Update OBS WebSocket server with new username (always)
                if self.obs_update_callback:
                    try:
                        obs_success = self.obs_update_callback(username)
                        if obs_success:
                            logger.info(f"SUCCESS: Updated OBS WebSocket with username: {username}")
                        else:
                            logger.warning(f"WARNING: Failed to update OBS WebSocket with username: {username}")
                    except Exception as obs_error:
                        logger.error(f"ERROR: Error updating OBS WebSocket: {obs_error}")
                else:
                    logger.warning("No OBS update callback available")
                
                # Mark this request as completed
                self.request_queue.task_done()
                
            except queue.Empty:
                continue
            except Exception as e:
                logger.error(f"Error in queue worker: {e}")
    
    def clear_queue(self) -> int:
        """Clear all pending requests and reset timing"""
        cleared_count = 0
        while not self.request_queue.empty():
            try:
                self.request_queue.get_nowait()
                cleared_count += 1
            except queue.Empty:
                break
        
        # Reset timing
        with self._lock:
            self.last_scheduled_time = datetime.now()
        
        logger.info(f"Cleared {cleared_count} requests from queue and reset timing")
        return cleared_count
    
    def get_queue_contents(self) -> list:
        """Get a snapshot of current queue contents for debugging (non-destructive)"""
        # Note: This is for debugging only and doesn't guarantee exact queue state
        # since other threads may be modifying the queue
        contents = []
        temp_queue = queue.Queue()
        
        # Move items to temp queue while capturing them
        while not self.request_queue.empty():
            try:
                item = self.request_queue.get_nowait()
                contents.append({
                    'username': item['username'],
                    'scheduled_time': item['scheduled_time'].isoformat(),
                    'queue_position': item.get('queue_position', 'unknown'),
                    'estimated_wait_seconds': item.get('estimated_wait_seconds', 'unknown')
                })
                temp_queue.put(item)
            except queue.Empty:
                break
        
        # Put items back
        while not temp_queue.empty():
            try:
                self.request_queue.put(temp_queue.get_nowait())
            except queue.Empty:
                break
        
        return contents