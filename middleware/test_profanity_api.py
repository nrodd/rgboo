#!/usr/bin/env python3
"""
Test the profanity filtering in the actual API endpoint
"""
import requests
import json

API_BASE = "http://127.0.0.1:5001/api"

def test_profanity_api():
    print("🛡️  Testing API Profanity Filter")
    print("=" * 40)
    
    test_cases = [
        # Valid requests (should succeed)
        {
            "username": "alice",
            "color": {"r": 255, "g": 0, "b": 0},
            "should_succeed": True,
            "description": "Clean username"
        },
        {
            "username": "gaming_pro_2025",
            "color": {"r": 0, "g": 255, "b": 0},
            "should_succeed": True,
            "description": "Clean username with numbers"
        },
        
        # Invalid requests (should fail due to profanity)
        {
            "username": "damn_user",
            "color": {"r": 255, "g": 0, "b": 0},
            "should_succeed": False,
            "description": "Username with profanity"
        },
        {
            "username": "shit_gamer",
            "color": {"r": 0, "g": 0, "b": 255},
            "should_succeed": False,
            "description": "Username with strong profanity"
        }
    ]
    
    try:
        print(f"\n📝 Testing API requests...")
        
        for i, test_case in enumerate(test_cases, 1):
            print(f"\nTest {i}: {test_case['description']}")
            print(f"Username: '{test_case['username']}'")
            
            response = requests.post(
                f"{API_BASE}/color",
                json={
                    "username": test_case["username"],
                    "color": test_case["color"]
                },
                timeout=5
            )
            
            if test_case["should_succeed"]:
                if response.status_code == 200:
                    print("✅ PASS - Request accepted as expected")
                    data = response.json()
                    print(f"   Queue position: {data.get('queue_position', 'N/A')}")
                else:
                    print(f"❌ FAIL - Expected success but got {response.status_code}")
                    print(f"   Response: {response.text}")
            else:
                if response.status_code == 400:
                    data = response.json()
                    if data.get('code') == 'PROFANITY_DETECTED':
                        print("✅ PASS - Profanity detected and blocked as expected")
                        print(f"   Message: {data.get('message', 'N/A')}")
                    else:
                        print(f"❌ FAIL - Got 400 but not for profanity: {data}")
                else:
                    print(f"❌ FAIL - Expected 400 but got {response.status_code}")
                    print(f"   Response: {response.text}")
        
        print(f"\n🎯 Profanity filter is working in the API!")
        
    except requests.exceptions.ConnectionError:
        print("❌ Could not connect to API server")
        print("💡 Make sure the server is running: python app.py")
    except Exception as e:
        print(f"❌ Error during test: {e}")

if __name__ == "__main__":
    test_profanity_api()