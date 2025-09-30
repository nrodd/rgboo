#include <Arduino.h>
#include <FastLED.h>
#include "SerialHandler.h"
#include "Config.h"

// LED strip setup
CRGB leds[MAX_LEDS];

SerialHandler serialHandler;

// Global variables to track current and target colors
CRGB currentColor = CRGB::Black;
CRGB targetColor = CRGB::Black;
bool transitionInProgress = false;

// Function to update LED colors with smooth transition
void updateLEDColor(uint8_t r, uint8_t g, uint8_t b, uint8_t brightness)
{
    // Always keep brightness at 20% (ignore incoming brightness parameter)
    FastLED.setBrightness(51); // 20% of 255 = 51

    // Set the target color for transition
    targetColor = CRGB(r, g, b);
    transitionInProgress = true;

    Serial.printf("Transitioning to: R=%d, G=%d, B=%d (Brightness fixed at 20%)\n", r, g, b);
}

// Function to handle smooth color transitions
void handleColorTransition()
{
    if (!transitionInProgress)
        return;

    // Transition parameters
    const uint8_t TRANSITION_SPEED = 8; // Higher = faster transition (1-255)

    // Calculate if we need to transition
    bool needsUpdate = false;
    CRGB newColor = currentColor;

    // Smoothly transition each color component
    if (currentColor.r != targetColor.r)
    {
        if (currentColor.r < targetColor.r)
        {
            newColor.r = min(currentColor.r + TRANSITION_SPEED, targetColor.r);
        }
        else
        {
            newColor.r = max(currentColor.r - TRANSITION_SPEED, targetColor.r);
        }
        needsUpdate = true;
    }

    if (currentColor.g != targetColor.g)
    {
        if (currentColor.g < targetColor.g)
        {
            newColor.g = min(currentColor.g + TRANSITION_SPEED, targetColor.g);
        }
        else
        {
            newColor.g = max(currentColor.g - TRANSITION_SPEED, targetColor.g);
        }
        needsUpdate = true;
    }

    if (currentColor.b != targetColor.b)
    {
        if (currentColor.b < targetColor.b)
        {
            newColor.b = min(currentColor.b + TRANSITION_SPEED, targetColor.b);
        }
        else
        {
            newColor.b = max(currentColor.b - TRANSITION_SPEED, targetColor.b);
        }
        needsUpdate = true;
    }

    // Update LEDs if color changed
    if (needsUpdate)
    {
        currentColor = newColor;
        fill_solid(leds, MAX_LEDS, currentColor);
        FastLED.show();
    }

    // Check if transition is complete
    if (currentColor.r == targetColor.r &&
        currentColor.g == targetColor.g &&
        currentColor.b == targetColor.b)
    {
        transitionInProgress = false;
        Serial.printf("Transition complete: R=%d, G=%d, B=%d\n",
                      currentColor.r, currentColor.g, currentColor.b);
    }
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

    // Set all LEDs to blue and initialize color state
    currentColor = CRGB::Blue;
    targetColor = CRGB::Blue;
    fill_solid(leds, MAX_LEDS, currentColor);
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

    // Handle smooth color transitions
    handleColorTransition();

    // Small delay to prevent overwhelming the CPU
    delay(10);
}