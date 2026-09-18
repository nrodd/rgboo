"""A SerialController stand-in that logs instead of touching the USB port.

--dry-run exercises the whole path -- Firestore, slot timing,
cancellation, OBS, status writes -- on a machine with no ESP32 attached,
or without fighting a running bridge for the port.
"""

import logging
from typing import Optional, Tuple

logger = logging.getLogger(__name__)


class DryRunSerialController:
    """Implements the slice of SerialController the bridge actually uses."""

    def __init__(self):
        self.port: Optional[str] = None

    def connect(self, port: Optional[str] = None) -> bool:
        logger.info(f"[dry-run] Would connect to serial port: {port or 'auto-detect'}")
        return True

    def disconnect(self) -> None:
        logger.info("[dry-run] Would disconnect from serial port")

    def is_connected(self) -> bool:
        # Reported honestly in the heartbeat: no port is open, so the
        # cloud API shows serial_connected: false.
        return False

    def send_color(self, r: int, g: int, b: int) -> Tuple[bool, str]:
        logger.info(f"[dry-run] Would send RGB command: RGB:{r},{g},{b}")
        return True, "Dry run: color not sent"
