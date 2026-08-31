"""Periodic liveness write to meta/bridge.

The cloud API reads this doc to answer `bridge_online`, `serial_connected`,
and `serial_port` on GET / and GET /api/status -- the replacement for the
old middleware inspecting its own serial handle in-process.
"""

import logging
import threading
from typing import Optional

logger = logging.getLogger(__name__)


class HeartbeatWriter:
    """Writes meta/bridge every `interval_seconds` on a daemon thread."""

    def __init__(self, store, serial_controller, interval_seconds: float):
        self._store = store
        self._serial_controller = serial_controller
        self._interval = interval_seconds
        self._stop = threading.Event()
        self._thread: Optional[threading.Thread] = None

    def start(self) -> None:
        # Beat once up front so the cloud API sees the bridge immediately
        # rather than after a full interval.
        self.beat_once()
        self._thread = threading.Thread(target=self._loop, name='heartbeat', daemon=True)
        self._thread.start()
        logger.info(f"Heartbeat writer started ({self._interval}s interval)")

    def stop(self) -> None:
        self._stop.set()

    def beat_once(self) -> None:
        try:
            self._store.write_heartbeat(
                serial_connected=self._serial_controller.is_connected(),
                serial_port=self._serial_controller.port,
            )
        except Exception as e:
            # A failed heartbeat just makes the bridge look offline for a
            # while; never worth taking down the dispatch loop.
            logger.error(f"Failed to write heartbeat: {e}")

    def _loop(self) -> None:
        while not self._stop.wait(self._interval):
            self.beat_once()
