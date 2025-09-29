#ifndef SERIAL_HANDLER_H
#define SERIAL_HANDLER_H

#include <Arduino.h>
#include "Config.h"

// Callback function type for color changes
typedef void (*ColorCallback)(uint8_t r, uint8_t g, uint8_t b, uint8_t brightness);

class SerialHandler
{
private:
    char buffer[SERIAL_BUFFER_SIZE];
    int bufferIndex;
    unsigned long lastReceiveTime;
    ColorCallback colorCallback;

    void processReceivedData();
    void clearBuffer();
    void debugPrint(const String &message);
    bool parseRGBCommand(const String &data, uint8_t &r, uint8_t &g, uint8_t &b, uint8_t &brightness);

public:
    SerialHandler();
    void begin();
    void handleIncomingData();
    bool isDataAvailable();
    void setColorCallback(ColorCallback callback);
};

#endif // SERIAL_HANDLER_H