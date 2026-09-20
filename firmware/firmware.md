# Raspberry Pi Pico 2 firmware

Arduino-based firmware for an RP2350 Raspberry Pi Pico 2 controlling the PAUTIX
24 V WS2811 RGBIC COB strip.

## Features

- USB serial commands from the Windows bridge
- 50 addressable WS2811 segments in GRB order
- RP2350 PIO-backed LED output through FastLED
- Smooth color transitions
- Fixed 20% startup and command brightness limit

See [README.md](README.md) for wiring, building, flashing, and testing.
