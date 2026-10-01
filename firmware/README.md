# Raspberry Pi Pico 2 WS2811 controller

This firmware receives color commands from the Windows bridge over USB serial
and drives the PAUTIX 24 V RGBIC COB strip. The strip uses WS2811 signaling,
has 50 addressable 10 cm segments per 5 m strip, and uses RGB color order
(verified with pure red, green, and blue commands on the connected strip).

## Hardware

- Raspberry Pi Pico 2 (RP2350)
- PAUTIX 5 m, 24 V WS2811 RGBIC COB strip (Amazon ASIN B0BN5N3R82)
- Regulated 24 V power supply rated for at least 3 A
- 74AHCT125 or equivalent 3.3 V-to-5 V logic-level shifter
- 330-470 ohm resistor in series with the data line

The full 5 m strip's 3,150 COB emitters are grouped into 50 independently
controlled pixels. The connected installation uses five short pieces, each
approximately 12 inches (30 cm), joined in series with connector cables.
Based on the documented 10 cm addressable spacing, the configuration assumes
three pixels per piece, for 15 addressable pixels total. Connector cables do
not consume pixel addresses. `MAX_LEDS` counts addressable pixels, not emitters.
Counting from the controller's data output, piece 2 (pixels 3–5, zero-based)
stays static white from startup. Pieces 1, 3, 4, and 5 follow serial color commands.
The static piece uses an amber orange output mix of RGB (255, 80, 5)
at the same configured brightness limit. Adjust `STATIC_WHITE_RED`,
`STATIC_WHITE_GREEN`, and `STATIC_WHITE_BLUE` to tune it; these are direct LED
output values, applied without gamma correction before global brightness scaling.

## Wiring

Power everything off before changing the wiring.

```text
24 V supply +  -------------------------- strip +24V
24 V supply -  --------+----------------- strip GND
                       +----------------- Pico GND

Pico GP4 --> 74AHCT125 --> 330-470 ohm --> strip DI
                 ^
                 +--- 5 V supply (never 24 V)
```

- Connect at the strip's `DI` end and follow the printed direction arrow.
- The Pico, level shifter, and 24 V supply must share ground.
- Never connect the strip's 24 V rail to a Pico GPIO or power pin.
- The level shifter can use Pico `VBUS` as its 5 V supply while the Pico is
  powered over USB.

## VS Code and PlatformIO setup

1. Install [Visual Studio Code](https://code.visualstudio.com/).
2. In VS Code Extensions, install **PlatformIO IDE**.
3. Open this repository, then run **PlatformIO: Open Project** from the
   Command Palette and select the `firmware` directory. Opening `firmware`
   directly as the VS Code folder also works.
4. Let PlatformIO download the Pico toolchain and FastLED on the first build.
   This can take several minutes.
5. In the PlatformIO sidebar, select **pico2 > General > Build**, or run this
   in the PlatformIO terminal:

   ```powershell
   cd firmware
   pio run
   ```

The project uses the Arduino-Pico core so the existing Arduino/FastLED C++ can
run on RP2040 with minimal changes.

## First upload

For the first flash, hold the Pico's **BOOTSEL** button while plugging its USB
cable into the PC. Windows should mount an `RPI-RP2` drive. Then select
**pico > General > Upload** in PlatformIO, or run:

```powershell
cd firmware
pio run --target upload
```

If automatic upload cannot find the bootloader, build normally and copy
`.pio\build\pico2\firmware.uf2` onto the `RPI-RP2` drive. Later uploads should
normally reset into the bootloader automatically.

Do not leave the serial monitor or RGBoo bridge open during an upload; only one
program can own the COM port at a time.

## Test over USB serial

Find the Pico's COM port:

```powershell
pio device list
```

Open the monitor at 115200 baud:

```powershell
pio device monitor --baud 115200 --port COM5
```

Replace `COM5` with the port shown on your machine. The firmware starts strip 2
white and the other strips blue at the configured brightness (75/255).
Type one of these commands and press Enter:

```text
RGB:255,0,0
RGB:0,255,0
RGB:0,0,255
RGB:0,0,0
```

You should see strips 1, 3, 4, and 5 fade to the requested color and a transition
message appear in the monitor. Strip 2 must remain white throughout, including
after `RGB:0,0,0`, which turns only the responsive strips off.

To test from PowerShell without the PlatformIO monitor:

```powershell
$ledPort = [System.IO.Ports.SerialPort]::new("COM5", 115200)
$ledPort.Open()
$ledPort.WriteLine("RGB:255,0,0")
$ledPort.Close()
```

The Windows bridge uses the same newline-terminated `RGB:r,g,b` command, so no
application protocol change is required.

## Configuration

Edit `include/Config.h` to change the GPIO, pixel count, serial timeout, or
brightness limit. The current hardware configuration is:

```cpp
#define LEDS_PER_STRIP 3
#define STRIP_COUNT 5
#define MAX_LEDS (LEDS_PER_STRIP * STRIP_COUNT)
#define STATIC_WHITE_STRIP 2
#define LED_PIN 4
#define LED_BRIGHTNESS 75
#define LED_GAMMA 2.2f
```

Here, "strip" in the configuration means one short connected piece, not a full
5 m reel. `STATIC_WHITE_STRIP` is a one-based piece number along the data chain.
This configuration assumes all pieces have `LEDS_PER_STRIP` addressable pixels.
If white does not match the second piece's boundaries, verify the number of
10 cm addressable sections per piece and adjust `LEDS_PER_STRIP` accordingly.
Rebuild and upload the firmware after changing these settings.

Send original screen RGB values: the firmware applies gamma correction to the
LED output after blending, then FastLED applies the brightness limit. For example,
`RGB:216,102,21` becomes approximately `177,34,1` before brightness scaling.
Do not pre-correct commands in the bridge or serial monitor. Serial logs retain
the original RGB values. Set `LED_GAMMA` to `1.0f` to disable correction.
