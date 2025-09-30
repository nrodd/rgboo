#!/usr/bin/env python3
"""
Quick test to verify the color queue is working as expected in production
"""
import requests
import json
import time

API_BASE = "http://127.0.0.1:5001/api"

def test_queue_api():
    print("🧪 Testing Color Queue API")
    print("=" * 40)
    
    try:
        # Check initial queue status
        print("\n📊 Initial Queue Status:")
        response = requests.get(f"{API_BASE}/queue")
        if response.status_code == 200:
            status = response.json()
            print(f"Queue Size: {status.get('queue_size', 'N/A')}")
            print(f"Worker Running: {status.get('worker_running', 'N/A')}")
            print(f"Next Available: {status.get('next_available_slot', 'N/A')}")
        else:
            print(f"❌ Failed to get queue status: {response.status_code}")
            return
        
        # Test adding requests
        print(f"\n📝 Adding test color requests...")
        
        test_requests = [
            {"username": "testuser1", "color": {"r": 255, "g": 0, "b": 0}},
            {"username": "testuser2", "color": {"r": 0, "g": 255, "b": 0}},
            {"username": "testuser3", "color": {"r": 0, "g": 0, "b": 255}}
        ]
        
        for i, req in enumerate(test_requests, 1):
            response = requests.post(f"{API_BASE}/color", json=req)
            if response.status_code == 200:
                data = response.json()
                print(f"Request {i}: {data['username']} - Position {data.get('queue_position', '?')}, Wait: {data.get('estimated_wait_seconds', '?')}s")
            else:
                print(f"❌ Failed to add request {i}: {response.status_code}")
        
        # Check final queue status
        print(f"\n📊 Final Queue Status:")
        response = requests.get(f"{API_BASE}/queue")
        if response.status_code == 200:
            status = response.json()
            print(f"Queue Size: {status.get('queue_size', 'N/A')}")
            print(f"Queue Contents:")
            for item in status.get('queue_contents', []):
                print(f"  - {item['username']}: Position {item['queue_position']}, Wait {item['estimated_wait_seconds']}s")
        
        print(f"\n✅ Queue API test completed!")
        
    except requests.exceptions.ConnectionError:
        print("❌ Could not connect to API server")
        print("💡 Make sure the server is running: python app.py")
    except Exception as e:
        print(f"❌ Error during test: {e}")

if __name__ == "__main__":
    test_queue_api()