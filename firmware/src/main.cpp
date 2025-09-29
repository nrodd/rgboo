#include <Arduino.h>
#include <FastLED.h>
#include "SerialHandler.h"
#include "Config.h"

// LED strip setup
CRGB leds[MAX_LEDS];

SerialHandler serialHandler;

// Function to update LED colors
void updateLEDColor(uint8_t r, uint8_t g, uint8_t b, uint8_t brightness)
{
    // Always keep brightness at 20% (ignore incoming brightness parameter)
    FastLED.setBrightness(51); // 20% of 255 = 51

    // Set all LEDs to the specified color
    CRGB color = CRGB(r, g, b);
    fill_solid(leds, MAX_LEDS, color);

    // Update the LED strip
    FastLED.show();

    Serial.printf("LEDs updated: R=%d, G=%d, B=%d (Brightness fixed at 20%)\n", r, g, b);
}

void setup()
{
    // Initialize serial communication
    Serial.begin(SERIAL_BAUD_RATE);

    // Wait for serial port to connect
    while (!Serial)
    {
        delay(10);
    }

    Serial.println("ESP32 RGB Controller Starting...");

    // Initialize FastLED
    FastLED.addLeds<WS2812B, LED_PIN, GRB>(leds, MAX_LEDS);
    FastLED.setBrightness(51); // 20% of 255 = 51

    // Set all LEDs to red
    fill_solid(leds, MAX_LEDS, CRGB::Blue);
    FastLED.show();

    Serial.println("LEDs set to blue at 20% brightness");
    Serial.println("Waiting for color data over USB serial...");
    Serial.println("Send commands like: RGB:255,0,0 (red) or RGB:0,255,0 (green)");
    Serial.println("Note: Brightness is fixed at 20% - brightness values in commands are ignored");

    // Initialize serial handler and set color callback
    serialHandler.begin();
    serialHandler.setColorCallback(updateLEDColor);
}

void loop()
{
    // Check for incoming serial data
    serialHandler.handleIncomingData();

    // Small delay to prevent overwhelming the CPU
    delay(10);
}