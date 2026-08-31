"""The dispatch loop: wait for each request's slot, then drive the LEDs.

Ported from ColorQueue._worker_loop (middleware/color_queue.py:82-138).
The differences are all consequences of the queue living in Firestore
instead of an in-process queue.Queue:

  * Work arrives by upsert()/sync() from a listener or poller, rather
    than from queue.get(), and is ordered by scheduled_time rather than
    by insertion (a snapshot can deliver docs in any order).
  * The doc is re-read immediately before the serial write, so a request
    cancelled by POST /api/queue/clear while it waited is skipped. This
    is the mechanism that makes queue-clear actually stop the LEDs.
  * Requests are marked done/failed in Firestore, which both replaces
    the old SQLite log and stops them being re-delivered.
"""

import logging
import threading
from datetime import datetime, timezone
from typing import Callable, Iterable, Optional

from shared.schema import STATUS_PENDING

from .store import ColorRequest

logger = logging.getLogger(__name__)


class ColorProcessor:
    """Holds known pending requests and dispatches each at its slot."""

    def __init__(
        self,
        store,
        serial_controller,
        obs_update_callback: Optional[Callable[[str], bool]] = None,
        idle_wait_seconds: float = 5.0,
        max_wait_seconds: float = 30.0,
        clock: Callable[[], datetime] = lambda: datetime.now(timezone.utc),
    ):
        self._store = store
        self._serial_controller = serial_controller
        self._obs_update_callback = obs_update_callback
        self._idle_wait = idle_wait_seconds
        # Cap on a single wait, so a far-future slot is still re-evaluated
        # periodically (e.g. after the queue is cleared out from under us).
        self._max_wait = max_wait_seconds
        self._now = clock

        self._pending = {}
        # Doc ids currently mid-dispatch. Kept out of _pending so a
        # concurrent sync() can't queue the same request a second time.
        self._processing = set()
        self._cond = threading.Condition()
        self._stop_event = threading.Event()

    def upsert(self, request: ColorRequest) -> None:
        """Add or update a known pending request."""
        with self._cond:
            if request.doc_id in self._processing:
                return
            self._pending[request.doc_id] = request
            self._cond.notify_all()

    def discard(self, doc_id: str) -> None:
        """Forget a request that is no longer pending (done or cancelled)."""
        with self._cond:
            if self._pending.pop(doc_id, None) is not None:
                self._cond.notify_all()

    def sync(self, requests: Iterable[ColorRequest]) -> None:
        """Replace what we know with an authoritative list of pending docs.

        Used by the poller. Replacing rather than merging is what lets a
        missed cancellation (no REMOVED event seen) still drop out.
        """
        with self._cond:
            self._pending = {
                request.doc_id: request
                for request in requests
                if request.doc_id not in self._processing
            }
            self._cond.notify_all()

    def pending_count(self) -> int:
        with self._cond:
            return len(self._pending)

    def run(self) -> None:
        """Dispatch until stop() is called. Blocks; runs on the main thread."""
        logger.info("Bridge processing loop started")
        while not self._stop_event.is_set():
            try:
                self._tick()
            except Exception as e:
                # Same defensive posture as the original worker loop: one
                # bad request must not kill the daemon.
                logger.error(f"Error in bridge processing loop: {e}")
        logger.info("Bridge processing loop stopped")

    def stop(self) -> None:
        """Ask the loop to finish. Safe to call from a signal handler.

        Signal handlers run on the main thread -- the same thread that may
        be holding the condition lock -- so this never blocks on it. When
        the lock is held the loop is running rather than sleeping, and it
        picks up the event at the top of the next iteration anyway.
        """
        self._stop_event.set()
        if self._cond.acquire(blocking=False):
            try:
                self._cond.notify_all()
            finally:
                self._cond.release()

    def _tick(self) -> Optional[ColorRequest]:
        """Run one iteration: wait for work, or dispatch what is due.

        Returns the request dispatched this iteration, if any (handy in
        tests, which drive the loop one tick at a time).
        """
        with self._cond:
            request = self._earliest()

            if request is None:
                self._cond.wait(timeout=self._idle_wait)
                return None

            wait_seconds = (request.scheduled_time - self._now()).total_seconds()
            if wait_seconds > 0:
                logger.debug(
                    f"Waiting {wait_seconds:.1f}s before processing "
                    f"{request.username}'s request"
                )
                # A notify from the listener wakes this early, so a newly
                # arrived earlier slot isn't missed.
                self._cond.wait(timeout=min(wait_seconds, self._max_wait))
                return None

            del self._pending[request.doc_id]
            self._processing.add(request.doc_id)

        try:
            self._dispatch(request)
        finally:
            with self._cond:
                self._processing.discard(request.doc_id)

        return request

    def _earliest(self) -> Optional[ColorRequest]:
        """The pending request with the soonest slot. Caller holds the lock."""
        if not self._pending:
            return None
        return min(self._pending.values(), key=lambda request: request.scheduled_time)

    def _dispatch(self, request: ColorRequest) -> None:
        """Re-read, send to the ESP32, update OBS, and close the doc out."""
        fresh = self._store.reload(request.doc_id)
        if fresh is None:
            logger.warning(f"Request {request.request_id} disappeared before dispatch")
            return
        if fresh.status != STATUS_PENDING:
            logger.info(
                f"Skipping request {fresh.request_id} from {fresh.username}: "
                f"status is '{fresh.status}'"
            )
            return

        logger.info(f"Processing color request for {fresh.username} at {self._now()}")

        success, message = self._serial_controller.send_color(fresh.r, fresh.g, fresh.b)
        if success:
            logger.info(
                f"SUCCESS: Sent color RGB({fresh.r}, {fresh.g}, {fresh.b}) "
                f"to ESP32 for {fresh.username}"
            )
        else:
            logger.error(f"ERROR: Failed to send color for {fresh.username}: {message}")

        # Update OBS regardless of the serial result, matching the old
        # worker loop -- the overlay reflects whose turn it was.
        self._update_obs(fresh.username)

        try:
            if success:
                self._store.mark_done(fresh.doc_id)
            else:
                self._store.mark_failed(fresh.doc_id, message)
        except Exception as e:
            # Leaving it pending is the safe failure: it will be retried
            # rather than silently dropped.
            logger.error(f"Failed to record status for {fresh.request_id}: {e}")

    def _update_obs(self, username: str) -> None:
        if not self._obs_update_callback:
            logger.warning("No OBS update callback available")
            return
        try:
            if self._obs_update_callback(username):
                logger.info(f"SUCCESS: Updated OBS WebSocket with username: {username}")
            else:
                logger.warning(
                    f"WARNING: Failed to update OBS WebSocket with username: {username}"
                )
        except Exception as obs_error:
            logger.error(f"ERROR: Error updating OBS WebSocket: {obs_error}")
