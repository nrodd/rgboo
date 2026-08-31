
<img width="1280" height="640" alt="Frame 1" src="https://github.com/user-attachments/assets/eb4006a3-cf0b-45b5-ba8a-ae0744f52fe7" />

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

### ☁️ `cloud_api/`
**Python Flask API on Cloud Run**
- The middleware's HTTP half, moved to Google Cloud
- Validates color requests and paces them one per 20 seconds
- Stores the queue in Firestore, so it survives restarts
- Deployed on demand from Actions -> Deploy API

### 🌉 `bridge/`
**Python daemon on the home machine**
- The half that cannot move to the cloud: it owns the USB cable
- Watches Firestore for pending requests and waits for each one's turn
- Writes colors to the ESP32 and serves the OBS overlay
- Runs under systemd; updated by pulling on that machine

## 🏗️ Architecture

The system splits at the queue: the cloud decides *when* each colour runs, and
a daemon at home does the physical USB write. See
**[docs/architecture.md](docs/architecture.md)** for diagrams, the data model,
failure modes, and the security posture.

## 🚀 Deploying

Nothing deploys on merge. The API has a one-click workflow
(Actions -> **Deploy API**); everything else is a deliberate command.

See **[docs/architecture.md](docs/architecture.md)** for how the system fits
together, and **[docs/deploying.md](docs/deploying.md)** for shipping each
component and rolling it back. The migration from the old always-on middleware to GCP is
described in [docs/gcp-migration-plan.md](docs/gcp-migration-plan.md)

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
