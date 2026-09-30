#include <Arduino.h>
#include <FastLED.h>
#include <math.h>
#include "SerialHandler.h"
#include "Config.h"

// LED strip setup
CRGB leds[MAX_LEDS];

SerialHandler serialHandler;

// Global variables to track current and target colors
CRGB currentColor = CRGB::Black;
CRGB targetColor = CRGB::Black;
bool transitionInProgress = false;

uint8_t gammaCorrect(uint8_t channel)
{
    return static_cast<uint8_t>(powf(channel / 255.0f, LED_GAMMA) * 255.0f + 0.5f);
}

// Keep transitions and serial logs in input RGB space; correct only the output.
void showCurrentColor()
{
    const CRGB outputColor(gammaCorrect(currentColor.r),
                           gammaCorrect(currentColor.g),
                           gammaCorrect(currentColor.b));
    fill_solid(leds, MAX_LEDS, outputColor);
    FastLED.show();
}

// Function to update LED colors with smooth transition
void updateLEDColor(uint8_t r, uint8_t g, uint8_t b, uint8_t brightness)
{
    // Always keep brightness at 20% (ignore incoming brightness parameter)
    FastLED.setBrightness(LED_BRIGHTNESS); // 20% of 255 = 51

    // Set the target color for transition
    targetColor = CRGB(r, g, b);
    transitionInProgress = true;

    Serial.printf("Transitioning to: R=%d, G=%d, B=%d (Brightness fixed at 20%)\n", r, g, b);
}

// Function to handle smooth color transitions using FastLED blend
void handleColorTransition()
{
    if (!transitionInProgress)
        return;

    // Transition parameters - how much to blend toward target each frame
    const uint8_t BLEND_AMOUNT = 20; // Higher = faster transition (1-255)

    // Use FastLED's blend function for smooth color mixing
    currentColor = blend(currentColor, targetColor, BLEND_AMOUNT);

    // Update all LEDs with the blended color
    showCurrentColor();

    // Check if transition is complete (colors are very close)
    if (abs(currentColor.r - targetColor.r) <= 1 &&
        abs(currentColor.g - targetColor.g) <= 1 &&
        abs(currentColor.b - targetColor.b) <= 1)
    {

        // Snap to exact target color and finish transition
        currentColor = targetColor;
        showCurrentColor();

        transitionInProgress = false;
        Serial.printf("Transition complete: R=%d, G=%d, B=%d\n",
                      currentColor.r, currentColor.g, currentColor.b);
    }
}

void setup()
{
    // Initialize serial communication
    Serial.begin(SERIAL_BAUD_RATE);

    // Give Windows a chance to enumerate USB serial, but still start the LEDs
    // when the controller application is not running.
    const unsigned long serialWaitStarted = millis();
    while (!Serial && (millis() - serialWaitStarted) < SERIAL_CONNECT_TIMEOUT)
    {
        delay(10);
    }

    Serial.println("Pico WS2811 Controller Starting...");

    // Pure-color testing confirmed RGB wire order for the connected strip.
    FastLED.addLeds<WS2811, LED_PIN, RGB>(leds, MAX_LEDS);
    FastLED.setBrightness(LED_BRIGHTNESS);

    // Set all LEDs to blue and initialize color state
    currentColor = CRGB::Blue;
    targetColor = CRGB::Blue;
    showCurrentColor();

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
