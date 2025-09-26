# ESP32 RGB Controller Firmware 

This firmware reads color data from USB serial port and will eventually control RGB LEDs connected to an ESP32.

## Current Features
- USB Serial communication at 115200 baud
- Data reception and echo functionality
- Buffer management with overflow protection
- Timeout handling for incomplete messages
- Debug output support
- Basic color command detection (RGB: prefixes)

## Hardware Requirements
- ESP32 development board
- USB connection to computer
- (Future) RGB LED strip connected to GPIO pin 2

## File Structure
```
firmware/
├── main.cpp           # Main application entry point
├── SerialHandler.h    # Serial communication class header
├── SerialHandler.cpp  # Serial communication implementation
├── Config.h           # Configuration constants
├── platformio.ini     # PlatformIO project configuration
└── README.md          # This file
```

## Building and Uploading

### Using PlatformIO (Recommended)
1. Install PlatformIO IDE or CLI
2. Navigate to the firmware directory
3. Build the project:
   ```bash
   pio run
   ```
4. Upload to ESP32:
   ```bash
   pio run --target upload
   ```
5. Monitor serial output:
   ```bash
   pio device monitor
   ```

## Usage
1. Connect ESP32 to computer via USB
2. Open serial monitor at 115200 baud
3. Send text data to the ESP32
4. The device will echo received data and detect color commands

## Supported Commands (Future)
- `RGB:255,128,64` - Set RGB color values

## Configuration
Edit `Config.h` to modify:
- Serial baud rate
- Buffer sizes
- GPIO pin assignments
- Debug output settings