# RGB Controller Middleware

A Python Flask API that serves as middleware between a web frontend and ESP32 firmware for controlling RGB LEDs.

## Features

- **RESTful API** for RGB color control
- **20-Second Queue System** - Requests are queued and sent after delay
- **USB Serial Communication** with ESP32
- **Automatic ESP32 Detection** via VID/PID matching
- **Real-Time OBS Studio Integration** - WebSocket-based browser source for live username updates
- **Unified Server Architecture** - Single Flask app handles both API and WebSocket connections
- **Security Controls** - OBS endpoints restricted to local access only
- **External API Access** - Ready for Cloudflare tunnel integration

## API Endpoints

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

### OBS Browser Source (Local Only)
```
GET /obs
```
**Local Access Only:** HTML page with real-time username updates via WebSocket for OBS Studio browser source. External access is blocked for security.

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

## Usage

### Development Server
```bash
python app.py
```

### Production Server
```bash
gunicorn -w 1 --worker-class eventlet -b 127.0.0.1:5001 app:app
```

The API will be available at `http://127.0.0.1:5001`
The OBS browser source will be available at `http://127.0.0.1:5001/obs` (local only)


## 👹 File Structure

```
middleware/
├── app.py                    # Main Flask app with SocketIO integration
├── routes.py                 # API route handlers
├── color_queue.py            # Queue system for 20-second delays
├── serial_controller.py      # ESP32 USB serial communication
├── obs.py                    # OBS Studio browser source integration
├── firmware_config.py        # Configuration settings
├── requirements.txt          # Python dependencies
├── test_api.py              # API test suite
├── test_obs.py              # OBS integration test
├── templates/
│   └── obs_browser_source.html  # OBS browser source HTML template
└── middleware.md            # This documentation
```

## Configuration

Environment variables (optional - see `firmware_config.py`):
- `HOST`: API host address (default: 127.0.0.1)
- `PORT`: API port number (default: 5001)
- `DEBUG`: Enable debug mode (default: True)
- `SERIAL_BAUD_RATE`: ESP32 baud rate (default: 115200)
- `SERIAL_TIMEOUT`: Serial timeout in seconds (default: 2)

## OBS Studio Integration

The middleware includes a real-time browser source for OBS Studio:

1. **Add Browser Source** in OBS Studio
2. **Set URL to:** `http://127.0.0.1:5001/obs`
3. **Username updates automatically** when color requests are processed

## ESP32 Communication

The middleware automatically:
1. **Detects ESP32** by scanning USB ports for known VID/PID pairs
2. **Establishes serial connection** at 115200 baud
3. **Sends color commands** in the format:
   - `RGB:255,128,64\n` for RGB values
4. **Handles connection errors** with automatic reconnection

**Security Model:**
- **API Endpoints** (`/api/*`): Accessible externally via Cloudflare
- **OBS Browser Source** (`/obs`): Local access only for security
- **WebSocket Updates**: Real-time username display in OBS
