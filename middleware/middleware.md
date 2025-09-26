# 🎃 RGB Controller Middleware

A Python Flask API that serves as middleware between a web frontend and ESP32 firmware for controlling RGB LEDs. Now includes a queue system for delayed execution and OBS Studio integration.

## 👻 Features

- **RESTful API** for RGB color control
- **20-Second Queue System** - Requests are queued and sent after delay
- **USB Serial Communication** with ESP32
- **Automatic ESP32 Detection** via VID/PID matching
- **Multiple Color Formats** (RGB values and HEX)
- **OBS Studio Integration** - Update text sources in OBS
- **Background Processing** - Queue worker processes requests automatically
- **Modular Architecture** - Clean separation of routes, queue, and controllers
- **User Tracking** with username logging
- **Error Handling** and validation
- **CORS Support** for web frontend integration
- **Comprehensive Logging** for debugging

## 🕷️ API Endpoints

### Health Check
```
GET /
```
Returns API status, ESP32 connection info, and queue status.

### Set RGB Color (Queued)
```
POST /api/color
Content-Type: application/json

{
    "username": "user123",
    "color": {
        "r": 255,
        "g": 128,
        "b": 64
    }
}
```
**Response:** Request is queued and will be sent to ESP32 after 20 seconds.

### Queue Management
```
GET /api/queue          # Get detailed queue status
POST /api/queue/clear   # Clear all pending requests
```

### System Status
```
GET /api/status
```
Returns serial connection status, available ports, and queue status.

## 🦇 Installation

1. **Create virtual environment:**
   ```bash
   python3 -m venv .venv
   source .venv/bin/activate  # On macOS/Linux
   # or
   .venv\Scripts\activate     # On Windows
   ```

2. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

4. **Configure environment (optional):**
   ```bash
   cp .env.example .env
   # Edit .env with your settings
   ```

## 🕸️ Usage

### Development Server
```bash
python run_dev_server.py
```

### Production Server
```bash
gunicorn -w 4 -b 127.0.0.1:5000 app:app
```

The API will be available at `http://127.0.0.1:5000`

## 🦴 Testing

Run the test suite to verify functionality:
```bash
python test_api.py
```

## 👹 File Structure

```
middleware/
├── app.py                 # Flask application setup and initialization
├── routes.py              # API route handlers (separated for cleanliness)
├── color_queue.py         # Queue system for 20-second delays
├── serial_controller.py   # ESP32 USB serial communication
├── obs.py                 # OBS Studio WebSocket integration
├── config.py             # Configuration settings
├── requirements.txt      # Python dependencies
├── .env.example         # Environment configuration template
├── run.py               # Development server launcher
├── test_api.py          # API test suite
├── README.md            # This file
└── middleware.md        # Original requirements
```

## Configuration

Environment variables (optional):
- `HOST`: API host address (default: 127.0.0.1)
- `PORT`: API port number (default: 5000)
- `DEBUG`: Enable debug mode (default: True)
- `SERIAL_BAUD_RATE`: ESP32 baud rate (default: 115200)
- `SERIAL_TIMEOUT`: Serial timeout in seconds (default: 2)

## ESP32 Communication

The middleware automatically:
1. **Detects ESP32** by scanning USB ports for known VID/PID pairs
2. **Establishes serial connection** at 115200 baud
3. **Sends color commands** in the format:
   - `RGB:255,128,64\n` for RGB values
   - `HEX:#FF8040\n` for hex colors
4. **Handles connection errors** with automatic reconnection

## Logging

All operations are logged to:
- Console output (development)
- `middleware.log` file (persistent)

Log levels include connection status, color commands, errors, and user activity.

## Error Handling

The API handles:
- Invalid JSON requests
- Missing required fields
- Out-of-range color values
- Serial connection failures
- ESP32 communication errors
- Queue processing errors

All errors return appropriate HTTP status codes and JSON error messages.

## 🕸️ Integration

This middleware is designed to work with:
- **Frontend**: React web interface for user color input
- **Firmware**: ESP32 C++ application for LED control  
- **Hardware**: ESP32 development board with RGB LED strips
- **OBS Studio**: For streaming overlays and text updates
- **Queue System**: 20-second delay for community-controlled lighting

## 🦴 Architecture Flow

```
Web Frontend → Flask API → Queue (20s delay) → ESP32 → RGB LEDs
                    ↓
               OBS Studio (optional text updates)
```

The updated middleware provides a robust, queue-based system perfect for community-controlled RGB lighting with streaming integration!