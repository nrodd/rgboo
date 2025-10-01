# 🎃 RGBoo 👻

A haunting collection of software that lets the community control RGB LEDs together! This project creates a complete pipeline where multiple users can submit color changes through a web interface, bringing shared lighting experiences to life - perfect for interactive displays, community art projects, or spooky collaborative lighting effects.

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
- Handles RGB color formats

### 🧙‍♀️ `middleware/`
**Python Flask API**
- REST API that bridges web and hardware
- Receives color requests from the web frontend
- Communicates with ESP32 via USB serial
- Starts a webssocket to communicate with OBS
- Handles user tracking and logging
- Auto-detects ESP32 connections
- Supports RGB colors

### 🕸️ `web/`
**React Web Interface**
- Modern React application built with Vite
- User-friendly color picker interface
- Deployed with Cloudflare workers
- Sends color commands to the middleware API
- Real-time color preview and control

## 🎭 Getting Started

### Quick Setup
1. **Flash the firmware** to your ESP32
2. **Start the middleware** API server
3. **Launch the web** interface
4. **Connect** ESP32 via USB
5. **Control** your RGB LEDs through the web!

## 🦴 Technology Stack

- **Frontend**: React, Vite, Cloudflare worker
- **Backend**: Python, Flask, pySerial
- **Firmware**: C++, Arduino Framework, PlatformIO
- **Hardware**: ESP32, RGB LED strips

## 👹 Contributing

Feel free to contribute to the project! Whether it's adding new features, fixing bugs, or improving documentation - all contributions are welcome.

## 📜 License

This project is open source - see the LICENSE file for details.

---

*May your LEDs glow bright and your code run without fright!* 🎃✨ 
