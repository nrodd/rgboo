#include "SerialHandler.h"

SerialHandler::SerialHandler()
{
    bufferIndex = 0;
    lastReceiveTime = 0;
    clearBuffer();
}

void SerialHandler::begin()
{
    debugPrint("Serial handler initialized");
    clearBuffer();
}

void SerialHandler::handleIncomingData()
{
    // Check if data is available
    while (Serial.available() > 0)
    {
        char incomingByte = Serial.read();
        lastReceiveTime = millis();

        // Handle different line endings and process complete messages
        if (incomingByte == '\n' || incomingByte == '\r')
        {
            if (bufferIndex > 0)
            {
                buffer[bufferIndex] = '\0'; // Null terminate
                processReceivedData();
                clearBuffer();
            }
        }
        else if (bufferIndex < SERIAL_BUFFER_SIZE - 1)
        {
            // Add character to buffer if there's space
            buffer[bufferIndex] = incomingByte;
            bufferIndex++;
        }
        else
        {
            // Buffer overflow protection
            debugPrint("Buffer overflow! Clearing buffer.");
            clearBuffer();
        }
    }

    // Timeout handling - clear buffer if no data received for a while
    if (bufferIndex > 0 && (millis() - lastReceiveTime) > SERIAL_TIMEOUT)
    {
        debugPrint("Serial timeout - clearing buffer");
        clearBuffer();
    }
}

void SerialHandler::processReceivedData()
{
    String receivedData = String(buffer);

    // Print received data
    Serial.println("=== Received Data ===");
    Serial.print("Raw data: ");
    Serial.println(receivedData);
    Serial.print("Length: ");
    Serial.println(receivedData.length());
    Serial.print("Timestamp: ");
    Serial.println(millis());

    // Basic color data parsing (for future RGB functionality)
    if (receivedData.startsWith("RGB:"))
    {
        debugPrint("Detected RGB color command");
        // Future: Parse RGB values and control LEDs
        Serial.println("RGB command detected - ready for LED control implementation");
    }
    else
    {
        // Generic data received
        Serial.println("Generic data received - echoing back:");
        Serial.print("Echo: ");
        Serial.println(receivedData);
    }

    Serial.println("=====================");
    Serial.println();
}

void SerialHandler::clearBuffer()
{
    bufferIndex = 0;
    memset(buffer, 0, SERIAL_BUFFER_SIZE);
}

bool SerialHandler::isDataAvailable()
{
    return Serial.available() > 0;
}

void SerialHandler::debugPrint(const String &message)
{
    if (DEBUG_ENABLED)
    {
        Serial.print("[DEBUG] ");
        Serial.println(message);
    }
}