#!/usr/bin/env python3
"""
Quick test to verify the OBS template refactoring is working
"""

import requests
import time

def test_obs_template():
    print("🧪 Testing OBS Browser Source Template...")
    
    try:
        # Give server time to start
        time.sleep(3)
        
        # Test the HTML template
        response = requests.get("http://localhost:5002", timeout=5)
        
        if response.status_code == 200:
            html_content = response.text
            
            # Check for key elements
            checks = [
                ("HTML Structure", "<!DOCTYPE html>" in html_content),
                ("Title", "RGB Controller - Current User" in html_content),
                ("Username Container", "username-container" in html_content),
                ("Socket.io Script", "socket.io.js" in html_content),
                ("WebSocket Events", "'username_update'" in html_content),
                ("Template Variable", "Waiting for user..." in html_content)
            ]
            
            print("✅ OBS Template Tests:")
            for test_name, result in checks:
                status = "✅ PASS" if result else "❌ FAIL"
                print(f"   {test_name}: {status}")
            
            all_passed = all(result for _, result in checks)
            
            if all_passed:
                print("\n🎉 Template refactoring successful!")
                print("📂 HTML template correctly separated to: templates/obs_browser_source.html")
                print("🌐 OBS Browser Source URL: http://localhost:5002")
                return True
            else:
                print("\n❌ Some template tests failed")
                return False
                
        else:
            print(f"❌ Server returned status code: {response.status_code}")
            return False
            
    except requests.exceptions.RequestException as e:
        print(f"❌ Could not connect to OBS server: {e}")
        print("💡 Make sure the server is running with: python app.py")
        return False

if __name__ == "__main__":
    test_obs_template()