# 🎃 RGBoo - Spooktacular RGB LED Controller 👻

A haunting collection of software that brings your RGB LEDs to life! This project creates a complete pipeline from web interface to hardware control, perfect for creating eerie lighting effects or any colorful display.

## 🦇 Project Architecture

```
Web Frontend → Flask API → ESP32 Firmware → RGB LEDs
```

The system consists of three main components working together:

## 📁 Directory Overview

### 👻 `firmware/`
**ESP32 C++ Application**
- Runs on an ESP32 development board
- Listens for color commands over USB serial
- Controls RGB LED strips connected to the board
- Built with Arduino framework and PlatformIO
- Handles RGB and HEX color formats

### 🧙‍♀️ `middleware/`
**Python Flask API**
- REST API that bridges web and hardware
- Receives color requests from the web frontend
- Communicates with ESP32 via USB serial
- Handles user tracking and logging
- Auto-detects ESP32 connections
- Supports both RGB values and HEX colors

### 🕸️ `web/`
**React Web Interface**
- Modern React application built with Vite
- User-friendly color picker interface
- Deployed on Cloudflare Pages
- Sends color commands to the middleware API
- Real-time color preview and control

## 🎭 Getting Started

### Prerequisites
- ESP32 development board with RGB LED strip
- Python 3.8+ for the middleware
- Node.js 18+ for the web interface
- PlatformIO or Arduino IDE for firmware

### Quick Setup
1. **Flash the firmware** to your ESP32
2. **Start the middleware** API server
3. **Launch the web** interface
4. **Connect** ESP32 via USB
5. **Control** your RGB LEDs through the web!

## 🦴 Technology Stack

- **Frontend**: React, Vite, Cloudflare Pages
- **Backend**: Python, Flask, pySerial
- **Firmware**: C++, Arduino Framework, PlatformIO
- **Hardware**: ESP32, RGB LED strips

## 👹 Contributing

Feel free to contribute to the project! Whether it's adding new features, fixing bugs, or improving documentation - all contributions are welcome.

## 📜 License

This project is open source - see the LICENSE file for details.

---

*May your LEDs glow bright and your code run without fright!* 🎃✨ 