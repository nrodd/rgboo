"""
Test script for the RGB Controller Middleware API
"""

import requests
import json
import time

BASE_URL = "http://127.0.0.1:5001"

def test_health_check():
    """Test the health check endpoint"""
    print("Testing health check...")
    try:
        response = requests.get(f"{BASE_URL}/")
        print(f"Status: {response.status_code}")
        print(f"Response: {json.dumps(response.json(), indent=2)}")
        return response.status_code == 200
    except Exception as e:
        print(f"Error: {e}")
        return False

def test_set_rgb_color():
    """Test setting RGB color"""
    print("\nTesting RGB color endpoint...")
    data = {
        "username": "testuser",
        "color": {
            "r": 255,
            "g": 128,
            "b": 64
        }
    }
    
    try:
        response = requests.post(
            f"{BASE_URL}/api/color",
            json=data,
            headers={'Content-Type': 'application/json'}
        )
        print(f"Status: {response.status_code}")
        print(f"Response: {json.dumps(response.json(), indent=2)}")
        return response.status_code == 200
    except Exception as e:
        print(f"Error: {e}")
        return False
    

def test_status_endpoint():
    """Test the status endpoint"""
    print("\nTesting status endpoint...")
    try:
        response = requests.get(f"{BASE_URL}/api/status")
        print(f"Status: {response.status_code}")
        print(f"Response: {json.dumps(response.json(), indent=2)}")
        return response.status_code == 200
    except Exception as e:
        print(f"Error: {e}")
        return False

def test_invalid_requests():
    """Test invalid request handling"""
    print("\nTesting invalid requests...")
    
    # Test missing username
    data = {"color": {"r": 255, "g": 128, "b": 64}}
    response = requests.post(f"{BASE_URL}/api/color", json=data)
    print(f"Missing username - Status: {response.status_code}")
    
    # Test invalid color values
    data = {"username": "test", "color": {"r": 300, "g": 128, "b": 64}}
    response = requests.post(f"{BASE_URL}/api/color", json=data)
    print(f"Invalid color value - Status: {response.status_code}")

if __name__ == "__main__":
    print("RGB Controller Middleware API Test Suite")
    print("=" * 50)
    print("Make sure the API server is running at http://127.0.0.1:5001")
    print("=" * 50)
    
    # Wait a moment for user to read
    time.sleep(2)
    
    # Run tests
    test_health_check()
    test_set_rgb_color()
    test_status_endpoint()
    test_invalid_requests()
    
    print("\n" + "=" * 50)
    print("Test suite completed!")
    print("Check the API logs for serial communication details.")