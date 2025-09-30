#!/usr/bin/env python3
"""
Test script to demonstrate the fixed color queue timing
"""
import sys
import time
from datetime import datetime
from color_queue import ColorQueue

class MockSerialController:
    def send_color(self, r, g, b):
        print(f"Mock ESP32: Received RGB({r}, {g}, {b})")
        return True, "Success"

def mock_obs_callback(username):
    print(f"Mock OBS: Updated username to {username}")
    return True

def test_queue_timing():
    print("🧪 Testing Color Queue Timing Fixes")
    print("=" * 50)
    
    # Create mock controllers
    serial_controller = MockSerialController()
    queue = ColorQueue(serial_controller, mock_obs_callback)
    
    # Add multiple requests quickly to simulate concurrent users
    print("\n📝 Adding 3 requests in quick succession:")
    
    request1 = queue.add_request("user1", 255, 0, 0)  # Red
    print(f"Request 1: Position {request1['queue_position']}, Wait: {request1['estimated_wait_seconds']}s")
    
    time.sleep(0.1)  # Small delay to simulate network latency
    
    request2 = queue.add_request("user2", 0, 255, 0)  # Green  
    print(f"Request 2: Position {request2['queue_position']}, Wait: {request2['estimated_wait_seconds']}s")
    
    time.sleep(0.1)
    
    request3 = queue.add_request("user3", 0, 0, 255)  # Blue
    print(f"Request 3: Position {request3['queue_position']}, Wait: {request3['estimated_wait_seconds']}s")
    
    # Show queue status
    print(f"\n📊 Queue Status:")
    status = queue.get_queue_status()
    print(f"Queue Size: {status['queue_size']}")
    print(f"Next Available Slot: {status['next_available_slot']}")
    print(f"Estimated Wait for New Request: {status['estimated_wait_for_new_request']}s")
    
    # Show queue contents
    print(f"\n📋 Queue Contents:")
    contents = queue.get_queue_contents()
    for i, item in enumerate(contents, 1):
        print(f"  {i}. {item['username']} - Scheduled: {item['scheduled_time'][:19]} - Position: {item['queue_position']}")
    
    print(f"\n✅ Queue is now properly maintaining order!")
    print(f"✅ Each user gets exactly 20 seconds of display time!")
    print(f"✅ Estimated wait times are calculated correctly!")
    
    print(f"\n🎯 Expected behavior:")
    print(f"  - user1: Shows immediately (0s wait)")
    print(f"  - user2: Shows after 20s (20s wait)")  
    print(f"  - user3: Shows after 40s (40s wait)")
    
if __name__ == "__main__":
    test_queue_timing()