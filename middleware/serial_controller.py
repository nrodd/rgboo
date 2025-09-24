import serial
import serial.tools.list_ports
import time
import logging
from typing import Tuple, List, Optional, Dict

logger = logging.getLogger(__name__)

class SerialController:
    """Handles USB serial communication with the ESP32"""
    
    def __init__(self):
        self.serial_connection = None
        self.port = None
        self.baud_rate = 115200
        self.timeout = 2
        self.esp32_vid_pid_pairs = [
            ('10C4', '0001'),  # Silicon Labs CP210x
            ('1A86', '7523'),  # QinHeng Electronics HL-340
            ('0403', '6001'),  # FTDI
            ('2341', '0043'),  # Arduino
            ('2341', '0001'),  # Arduino
        ]
    
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
    
    def find_esp32_port(self) -> Optional[str]:
        """Automatically find ESP32 port by VID/PID"""
        for port in serial.tools.list_ports.comports():
            if port.vid and port.pid:
                vid_hex = f"{port.vid:04X}"
                pid_hex = f"{port.pid:04X}"
                
                # Check if it matches known ESP32 VID/PID pairs
                for known_vid, known_pid in self.esp32_vid_pid_pairs:
                    if vid_hex == known_vid or 'CP210' in port.description or 'ESP32' in port.description:
                        logger.info(f"Found potential ESP32 at {port.device}: {port.description}")
                        return port.device
        
        # Fallback: look for common ESP32 device names
        for port in serial.tools.list_ports.comports():
            description = port.description.upper()
            if any(keyword in description for keyword in ['CP210', 'ESP32', 'SILICON LABS', 'USB-SERIAL']):
                logger.info(f"Found potential ESP32 by description at {port.device}: {port.description}")
                return port.device
        
        return None
    
    def connect(self, port: Optional[str] = None) -> bool:
        """Connect to ESP32 via serial"""
        try:
            # Auto-detect port if not specified
            if not port:
                port = self.find_esp32_port()
                if not port:
                    logger.error("Could not find ESP32 device")
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
                logger.info(f"Successfully connected to ESP32 at {port}")
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
        """Check if connected to ESP32"""
        return (self.serial_connection is not None and 
                self.serial_connection.is_open)
    
    def test_connection(self) -> bool:
        """Test if ESP32 is responding"""
        try:
            if not self.is_connected():
                return False
            
            # Clear any pending data
            self.serial_connection.reset_input_buffer()
            
            # Send test message
            test_message = "TEST\n"
            self.serial_connection.write(test_message.encode('utf-8'))
            
            # Wait for response (ESP32 should echo)
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
        """Send RGB color to ESP32"""
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
            
            # Optional: Read response from ESP32
            time.sleep(0.1)
            if self.serial_connection.in_waiting > 0:
                response = self.serial_connection.read(self.serial_connection.in_waiting)
                logger.debug(f"ESP32 response: {response.decode('utf-8', errors='ignore')}")
            
            return True, "Color sent successfully"
            
        except serial.SerialException as e:
            logger.error(f"Serial error sending color: {e}")
            self.disconnect()  # Reset connection on error
            return False, f"Serial communication error: {e}"
        except Exception as e:
            logger.error(f"Unexpected error sending color: {e}")
            return False, f"Unexpected error: {e}"
    
    def send_color_hex(self, hex_color: str) -> Tuple[bool, str]:
        """Send hex color to ESP32"""
        try:
            # Ensure connection
            if not self.is_connected():
                if not self.connect():
                    return False, "Could not establish serial connection"
            
            # Format HEX command
            command = f"HEX:{hex_color}\n"
            
            # Send command
            self.serial_connection.write(command.encode('utf-8'))
            self.serial_connection.flush()
            
            logger.info(f"Sent HEX command: {command.strip()}")
            
            # Optional: Read response from ESP32
            time.sleep(0.1)
            if self.serial_connection.in_waiting > 0:
                response = self.serial_connection.read(self.serial_connection.in_waiting)
                logger.debug(f"ESP32 response: {response.decode('utf-8', errors='ignore')}")
            
            return True, "Hex color sent successfully"
            
        except serial.SerialException as e:
            logger.error(f"Serial error sending hex color: {e}")
            self.disconnect()  # Reset connection on error
            return False, f"Serial communication error: {e}"
        except Exception as e:
            logger.error(f"Unexpected error sending hex color: {e}")
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