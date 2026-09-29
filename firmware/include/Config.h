#ifndef CONFIG_H
#define CONFIG_H

// Serial communication settings
#define SERIAL_BAUD_RATE 115200
#define SERIAL_TIMEOUT 1000

// Buffer settings
#define SERIAL_BUFFER_SIZE 256

// LED settings
#define MAX_LEDS 50
#define LED_PIN 4
#define LED_BRIGHTNESS 51
// Convert screen-style RGB values to LED output; 1.0 disables correction.
#define LED_GAMMA 2.2f

// Do not wait forever for Windows to open the Pico's USB serial port.
#define SERIAL_CONNECT_TIMEOUT 3000

// Debug settings
#define DEBUG_ENABLED true

#endif // CONFIG_H
