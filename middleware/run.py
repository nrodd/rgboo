#!/usr/bin/env python3
"""
RGB Controller Middleware - Development Server
Run this script to start the Flask development server
"""

import os
import sys
from dotenv import load_dotenv

# Add the current directory to Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Load environment variables
load_dotenv()

from app import app

if __name__ == '__main__':
    print("Starting RGB Controller Middleware API...")
    print(f"Server will run at http://127.0.0.1:5000")
    print("Press CTRL+C to stop the server")
    print("-" * 50)
    
    app.run(
        host='127.0.0.1',
        port=5000,
        debug=True
    )