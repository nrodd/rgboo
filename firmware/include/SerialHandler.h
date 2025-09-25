#ifndef SERIAL_HANDLER_H
#define SERIAL_HANDLER_H

#include <Arduino.h>
#include "Config.h"

class SerialHandler
{
private:
    char buffer[SERIAL_BUFFER_SIZE];
    int bufferIndex;
    unsigned long lastReceiveTime;

    void processReceivedData();
    void clearBuffer();
    void debugPrint(const String &message);

public:
    SerialHandler();
    void begin();
    void handleIncomingData();
    bool isDataAvailable();
};

#endif // SERIAL_HANDLER_H