import serial
import serial.tools.list_ports
import time
import logging
from typing import Tuple, List, Optional, Dict

logger = logging.getLogger(__name__)

class SerialController:
    """Handles USB serial communication with the LED controller."""

    # Arduino-Pico assigns Pico 2 (RP2350) PID 0x000F. Depending on the
    # enabled USB interfaces, the core may set one or more composite-device
    # bits in that PID.
    PICO_USB_VID = 0x2E8A
    PICO2_USB_PIDS = {
        0x000F, 0x010F, 0x400F, 0x410F,
        0x800F, 0x810F, 0xC00F, 0xC10F,
    }
    
    def __init__(self):
        self.serial_connection = None
        self.port = None
        self.baud_rate = 115200
        self.timeout = 2
        # Retain the adapters recognized by the previous controller setup as a
        # fallback for development hardware and USB-to-serial adapters.
        self.legacy_usb_vendor_ids = {
            0x10C4,  # Silicon Labs CP210x
            0x1A86,  # QinHeng Electronics HL-340/CH340
            0x0403,  # FTDI
            0x2341,  # Arduino
        }
    
    def get_available_ports(self) -> List[Dict]:
        """Get list of available serial ports"""
        ports = []
        for port in serial.tools.list_ports.comports():
            ports.append({
                'device': port.device,
                'description': port.description,
                'hwid': port.hwid,
                'vid': port.vid,
                'pid': port.pid
            })
        return ports
    
    def find_controller_port(self) -> Optional[str]:
        """Automatically find the Pico 2, with legacy adapters as fallback."""
        ports = list(serial.tools.list_ports.comports())

        # Prefer the deployed Pico 2 so a generic adapter cannot win merely
        # because Windows returned it first.
        for port in ports:
            if (port.vid == self.PICO_USB_VID
                    and port.pid in self.PICO2_USB_PIDS):
                logger.info(
                    f"Found Raspberry Pi Pico 2 at {port.device}: {port.description}"
                )
                return port.device

        for port in ports:
            description = (port.description or '').upper()
            if (port.vid in self.legacy_usb_vendor_ids
                    or any(keyword in description for keyword in (
                        'CP210', 'SILICON LABS', 'USB-SERIAL'
                    ))):
                logger.info(
                    f"Found potential LED controller at {port.device}: "
                    f"{port.description}"
                )
                return port.device
        
        return None
    
    def connect(self, port: Optional[str] = None) -> bool:
        """Connect to the LED controller via serial."""
        try:
            # Auto-detect port if not specified
            if not port:
                port = self.find_controller_port()
                if not port:
                    logger.error("Could not find Raspberry Pi Pico 2 controller")
                    return False
            
            # Close existing connection if any
            if self.serial_connection and self.serial_connection.is_open:
                self.serial_connection.close()
            
            # Create new connection
            self.serial_connection = serial.Serial(
                port=port,
                baudrate=self.baud_rate,
                timeout=self.timeout,
                write_timeout=self.timeout
            )
            
            self.port = port
            
            # Wait for connection to stabilize
            time.sleep(2)
            
            # Test connection by sending a ping
            if self.test_connection():
                logger.info(f"Successfully connected to Pico controller at {port}")
                return True
            else:
                logger.error(f"Connection test failed for {port}")
                self.disconnect()
                return False
                
        except serial.SerialException as e:
            logger.error(f"Serial connection error: {e}")
            return False
        except Exception as e:
            logger.error(f"Unexpected error connecting to serial: {e}")
            return False
    
    def disconnect(self):
        """Disconnect from serial port"""
        if self.serial_connection and self.serial_connection.is_open:
            self.serial_connection.close()
            logger.info(f"Disconnected from {self.port}")
        self.serial_connection = None
        self.port = None
    
    def is_connected(self) -> bool:
        """Check if connected to the LED controller."""
        return (self.serial_connection is not None and 
                self.serial_connection.is_open)
    
    def test_connection(self) -> bool:
        """Test whether the serial connection can write to the controller."""
        try:
            if not self.is_connected():
                return False
            
            # Clear any pending data
            self.serial_connection.reset_input_buffer()
            
            # Send test message
            test_message = "TEST\n"
            self.serial_connection.write(test_message.encode('utf-8'))
            
            # The firmware echoes generic input, but receiving the response is
            # optional: a successful write is enough to establish the link.
            time.sleep(0.5)
            
            # Check if there's any response
            if self.serial_connection.in_waiting > 0:
                response = self.serial_connection.read(self.serial_connection.in_waiting)
                logger.debug(f"Connection test response: {response}")
                return True
            
            return True  # Even if no echo, connection might be working
            
        except Exception as e:
            logger.error(f"Connection test failed: {e}")
            return False
    
    def send_color(self, r: int, g: int, b: int) -> Tuple[bool, str]:
        """Send an RGB color command to the Pico controller."""
        try:
            # Ensure connection
            if not self.is_connected():
                if not self.connect():
                    return False, "Could not establish serial connection"
            
            # Format RGB command
            command = f"RGB:{r},{g},{b}\n"
            
            # Send command
            self.serial_connection.write(command.encode('utf-8'))
            self.serial_connection.flush()
            
            logger.info(f"Sent RGB command: {command.strip()}")
            
            # Optional: read the firmware's diagnostic response.
            time.sleep(0.1)
            if self.serial_connection.in_waiting > 0:
                response = self.serial_connection.read(self.serial_connection.in_waiting)
                logger.debug(
                    f"Pico response: {response.decode('utf-8', errors='ignore')}"
                )
            
            return True, "Color sent successfully"
            
        except serial.SerialException as e:
            logger.error(f"Serial error sending color: {e}")
            self.disconnect()  # Reset connection on error
            return False, f"Serial communication error: {e}"
        except Exception as e:
            logger.error(f"Unexpected error sending color: {e}")
            return False, f"Unexpected error: {e}"
    
    
    def get_port_info(self) -> Optional[Dict]:
        """Get information about current port"""
        if not self.port:
            return None
        
        return {
            'port': self.port,
            'baud_rate': self.baud_rate,
            'connected': self.is_connected()
        }
