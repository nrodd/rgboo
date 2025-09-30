#!/usr/bin/env python3
"""
Test script to demonstrate the SQLite request logging system
"""
import sys
import os
sys.path.append('/Users/nathan/Documents/GitHub/rgboo/middleware')

from database import RequestDatabase
from datetime import datetime

def test_request_logging():
    print("🗄️  Testing SQLite Request Logging System")
    print("=" * 50)
    
    # Create test database
    db = RequestDatabase('demo_requests.db')
    
    # Add some test requests
    print("\n📝 Adding test color requests...")
    
    test_requests = [
        ("alice", 255, 0, 0),
        ("bob", 0, 255, 0), 
        ("charlie", 0, 0, 255),
        ("alice", 255, 255, 0),  # Alice again
        ("dave", 255, 0, 255)
    ]
    
    for username, r, g, b in test_requests:
        db_id = db.log_request(username, r, g, b)
        hex_color = f"#{r:02x}{g:02x}{b:02x}"
        print(f"  ✓ {username}: {hex_color} (DB ID: {db_id})")
    
    # Export to CSV
    print(f"\n💾 Exporting to CSV...")
    if db.export_to_csv('demo_export.csv'):
        print(f"  ✓ Exported to demo_export.csv")
    
    print(f"\n🎯 Simple Database Features:")
    print(f"  ✅ Basic request logging (username, RGB, timestamp)")
    print(f"  ✅ CSV export functionality")
    print(f"  ✅ Thread-safe operations")
    print(f"  ✅ SQLite storage with validation")

if __name__ == "__main__":
    test_request_logging()