#include <Arduino.h>
#include "SerialHandler.h"
#include "Config.h"

SerialHandler serialHandler;

void setup() {
    // Initialize serial communication
    Serial.begin(SERIAL_BAUD_RATE);
    
    // Wait for serial port to connect
    while (!Serial) {
        delay(10);
    }
    
    Serial.println("ESP32 RGB Controller Starting...");
    Serial.println("Waiting for color data over USB serial...");
    
    // Initialize serial handler
    serialHandler.begin();
}

void loop() {
    // Check for incoming serial data
    serialHandler.handleIncomingData();
    
    // Small delay to prevent overwhelming the CPU
    delay(10);
}