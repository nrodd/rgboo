"""Publish the color + username currently on the LEDs to the SSE fan-out.

The dispatch loop (bridge/processor.py) runs on the main thread and must never
block on the network, so publishing happens on a background worker thread: the
dispatch loop just hands off a payload and moves on. Same fan-out endpoint
family as now_playing, so a failed push is logged and dropped, never fatal.
"""

import json
import logging
import queue
import threading
from typing import Callable, Optional
from urllib.request import Request, urlopen

logger = logging.getLogger(__name__)

# Sentinel put on the queue by stop() to wake the worker for a clean exit.
_SHUTDOWN = object()


def post_color(url: str, push_secret: Optional[str], display: dict) -> None:
    """POST one color update, raising when Cloudflare rejects the request."""
    headers = {
        'Content-Type': 'application/json',
        # Cloudflare rejects urllib's default Python-urllib/* signature with
        # edge error 1010 before the request can reach the Worker.
        'User-Agent': 'rgboo-bridge/1.0',
    }
    if push_secret:
        headers['X-Push-Secret'] = push_secret

    request = Request(
        url,
        data=json.dumps(display).encode('utf-8'),
        headers=headers,
        method='POST',
    )
    with urlopen(request, timeout=10) as response:
        if not 200 <= response.status < 300:
            raise RuntimeError(f"update-color endpoint returned HTTP {response.status}")


class ColorPublisher:
    """Fire-and-forget POSTs of the current color/username on a worker thread."""

    def __init__(
        self,
        url: str,
        push_secret: Optional[str] = None,
        poster: Callable[[str, Optional[str], dict], None] = post_color,
    ):
        self._url = url
        self._push_secret = push_secret
        self._poster = poster
        self._queue: "queue.Queue" = queue.Queue()
        self._thread: Optional[threading.Thread] = None

    def start(self) -> None:
        self._thread = threading.Thread(
            target=self._run,
            name='color-publisher',
            daemon=True,
        )
        self._thread.start()

    def stop(self) -> None:
        self._queue.put(_SHUTDOWN)
        if self._thread is not None:
            self._thread.join(timeout=5)

    def publish(self, username: str, r: int, g: int, b: int) -> None:
        """Queue the current display for publishing. Never blocks the caller."""
        self._queue.put({'username': username, 'r': r, 'g': g, 'b': b})

    def _run(self) -> None:
        while True:
            display = self._queue.get()
            if display is _SHUTDOWN:
                return
            try:
                self._poster(self._url, self._push_secret, display)
                logger.info(
                    "Published display: %s RGB(%s, %s, %s)",
                    display['username'], display['r'], display['g'], display['b'],
                )
            except Exception as error:
                # A network failure here must never affect LED dispatch.
                logger.error("Failed to publish color update: %s", error)
