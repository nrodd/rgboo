"""Two ways to learn about pending requests: a live stream, or polling.

PendingWatcher is the default. Firestore's on_snapshot holds an outbound
gRPC stream, so it needs no inbound port on the home machine and picks up
new requests within a second or so.

PendingPoller is the fallback (--poll), and also runs alongside the
watcher on a slow interval as a safety net: if the stream dies quietly,
the next resync still finds the work.
"""

import logging
import threading
from typing import Optional

from .store import to_color_request

logger = logging.getLogger(__name__)


class PendingWatcher:
    """Feeds the processor from a Firestore on_snapshot subscription."""

    def __init__(self, store, processor):
        self._store = store
        self._processor = processor
        self._watch = None

    def start(self) -> None:
        self._watch = self._store.watch_pending(self._on_snapshot)
        logger.info("Listening for pending requests via Firestore snapshots")

    def stop(self) -> None:
        if self._watch is not None:
            try:
                self._watch.unsubscribe()
            except Exception as e:
                logger.warning(f"Error unsubscribing from Firestore watch: {e}")
            self._watch = None

    def _on_snapshot(self, doc_snapshots, changes, read_time) -> None:
        """Route snapshot changes into the processor.

        A doc leaves the status == 'pending' query when it is cancelled or
        when we finish it, and arrives as a REMOVED change either way.
        """
        try:
            for change in changes:
                change_type = change.type.name
                if change_type == 'REMOVED':
                    self._processor.discard(change.document.id)
                    continue

                request = to_color_request(change.document)
                if request is not None:
                    self._processor.upsert(request)
                    logger.debug(
                        f"{change_type} pending request {request.request_id} "
                        f"scheduled for {request.scheduled_time}"
                    )
        except Exception as e:
            logger.error(f"Error handling Firestore snapshot: {e}")


class PendingPoller:
    """Feeds the processor by re-listing pending requests on an interval."""

    def __init__(self, store, processor, interval_seconds: float):
        self._store = store
        self._processor = processor
        self._interval = interval_seconds
        self._stop = threading.Event()
        self._thread: Optional[threading.Thread] = None

    def start(self) -> None:
        self._thread = threading.Thread(target=self._loop, name='pending-poller', daemon=True)
        self._thread.start()
        logger.info(f"Polling for pending requests every {self._interval}s")

    def stop(self) -> None:
        self._stop.set()

    def poll_once(self) -> None:
        """Re-list pending requests and hand the processor the full set."""
        try:
            self._processor.sync(self._store.list_pending())
        except Exception as e:
            logger.error(f"Error polling for pending requests: {e}")

    def _loop(self) -> None:
        while not self._stop.is_set():
            self.poll_once()
            self._stop.wait(self._interval)
