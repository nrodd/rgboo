#include "SerialHandler.h"

SerialHandler::SerialHandler()
{
    bufferIndex = 0;
    lastReceiveTime = 0;
    colorCallback = nullptr;
    clearBuffer();
}

void SerialHandler::begin()
{
    debugPrint("Serial handler initialized");
    clearBuffer();
}

void SerialHandler::setColorCallback(ColorCallback callback)
{
    colorCallback = callback;
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

    // Parse RGB color commands
    if (receivedData.startsWith("RGB:"))
    {
        debugPrint("Detected RGB color command");
        uint8_t r, g, b, brightness;
        if (parseRGBCommand(receivedData, r, g, b, brightness))
        {
            Serial.printf("Parsed RGB: R=%d, G=%d, B=%d, Brightness=%d\n", r, g, b, brightness);
            if (colorCallback != nullptr)
            {
                colorCallback(r, g, b, brightness);
            }
        }
        else
        {
            Serial.println("Failed to parse RGB command");
        }
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

bool SerialHandler::parseRGBCommand(const String &data, uint8_t &r, uint8_t &g, uint8_t &b, uint8_t &brightness)
{
    // Expected format: "RGB:r,g,b" or "RGB:r,g,b,brightness"
    // Example: "RGB:255,0,0" for red or "RGB:255,0,0,100" for red at ~40% brightness

    int startPos = 4; // Skip "RGB:"
    if (startPos >= data.length())
        return false;

    // Find comma positions
    int firstComma = data.indexOf(',', startPos);
    int secondComma = data.indexOf(',', firstComma + 1);
    int thirdComma = data.indexOf(',', secondComma + 1);

    if (firstComma == -1 || secondComma == -1)
        return false;

    // Parse RGB values
    r = data.substring(startPos, firstComma).toInt();
    g = data.substring(firstComma + 1, secondComma).toInt();

    // Parse B and optional brightness
    if (thirdComma == -1)
    {
        // No brightness specified, parse B and use default brightness
        b = data.substring(secondComma + 1).toInt();
        brightness = 255; // Default to full brightness
    }
    else
    {
        // Brightness specified
        b = data.substring(secondComma + 1, thirdComma).toInt();
        brightness = data.substring(thirdComma + 1).toInt();
    }

    // Validate ranges
    if (r > 255 || g > 255 || b > 255 || brightness > 255)
    {
        return false;
    }

    return true;
}