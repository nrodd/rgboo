#ifndef CONFIG_H
#define CONFIG_H

// Serial communication settings
#define SERIAL_BAUD_RATE 115200
#define SERIAL_TIMEOUT 1000

// Buffer settings
#define SERIAL_BUFFER_SIZE 256

// LED settings
// Each connected piece is about 12 inches (30 cm): three 10 cm pixels.
#define LEDS_PER_STRIP 3
#define STRIP_COUNT 5
#define MAX_LEDS (LEDS_PER_STRIP * STRIP_COUNT)
// Strip numbers follow the data path from the controller and start at 1.
#define STATIC_WHITE_STRIP 2
// Amber output mix: strong yellow/orange with almost no blue.
#define STATIC_WHITE_RED 255
#define STATIC_WHITE_GREEN 80
#define STATIC_WHITE_BLUE 5
#define LED_PIN 4
#define LED_BRIGHTNESS 75
// Convert screen-style RGB values to LED output; 1.0 disables correction.
#define LED_GAMMA 2.2f

// Do not wait forever for Windows to open the Pico's USB serial port.
#define SERIAL_CONNECT_TIMEOUT 3000

// Debug settings
#define DEBUG_ENABLED true

#endif // CONFIG_H
