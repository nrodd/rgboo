"""Acting on the cloud's request to blank the OBS overlay.

The cloud cannot reach this machine, so an admin clear arrives as a document
(`meta/overlay_control`) that this side watches. The only state is the last
handled timestamp, which makes repeated deliveries idempotent.
See docs/admin-clear-current.md.
"""

import logging
import threading
from typing import Callable, Optional

from shared.schema import DEFAULT_OBS_USERNAME

logger = logging.getLogger(__name__)


class OverlayController:
    """Blanks the overlay when the cloud asks, at most once per request."""

    def __init__(self, store, obs_update_callback: Optional[Callable[[str], bool]]):
        self._store = store
        self._obs_update_callback = obs_update_callback
        self._last_handled = None
        self._lock = threading.Lock()

    def prime(self) -> None:
        """Treat an existing request as handled: the overlay is blank at boot."""
        try:
            self._last_handled = self._store.read_overlay_clear_request()
            logger.info("Overlay control primed")
        except Exception as e:
            # Staying None honours the next request -- the safe direction here.
            logger.error(f"Could not prime overlay control: {e}")

    def handle(self, requested_at) -> bool:
        """Blank the overlay if this request is newer than the last seen."""
        if requested_at is None:
            return False

        with self._lock:
            if self._last_handled is not None and requested_at <= self._last_handled:
                return False
            self._last_handled = requested_at

        return self._blank()  # outside the lock: emits over SocketIO

    def check_now(self) -> bool:
        """Re-read and act. The resync poll's safety net for a dead stream."""
        try:
            return self.handle(self._store.read_overlay_clear_request())
        except Exception as e:
            logger.error(f"Error checking overlay control: {e}")
            return False

    def _blank(self) -> bool:
        if not self._obs_update_callback:
            logger.warning("Overlay clear requested, but no OBS callback is wired")
            return False
        try:
            self._obs_update_callback(DEFAULT_OBS_USERNAME)
            logger.warning("Overlay cleared by admin request")
            return True
        except Exception as e:
            logger.error(f"Failed to clear the overlay: {e}")
            return False
