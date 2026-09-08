"""Firestore-backed color-request queue and pacing clock.

Mirrors the interface of the old in-process ColorQueue
(middleware/color_queue.py) so cloud_api/routes.py ports over almost
unchanged, and so tests can swap in a fake/mock store.
"""

import hashlib
import logging
import time
import uuid
from datetime import datetime, timezone

from typing import Optional

from google.cloud import firestore

from shared.schema import (
    BRIDGE_DOC,
    BRIDGE_STALE_SECONDS,
    DENYLIST_COLLECTION,
    META_COLLECTION,
    OVERLAY_CONTROL_DOC,
    PACING_DOC,
    REDACTED_USERNAME,
    REQUESTS_COLLECTION,
    SLOT_SECONDS,
    STATUS_CANCELLED,
    STATUS_PENDING,
)

from .pacing import next_slot

logger = logging.getLogger(__name__)


class RequestStore:
    """Queue, pacing clock, and request log, all backed by Firestore."""

    def __init__(self, client: firestore.Client):
        self._client = client
        self._requests = client.collection(REQUESTS_COLLECTION)
        self._pacing_ref = client.collection(META_COLLECTION).document(PACING_DOC)
        self._bridge_ref = client.collection(META_COLLECTION).document(BRIDGE_DOC)
        self._overlay_ref = client.collection(META_COLLECTION).document(OVERLAY_CONTROL_DOC)
        self._denylist = client.collection(DENYLIST_COLLECTION)

    def add_request(self, username: str, r: int, g: int, b: int) -> dict:
        """Assign the next pacing slot and create a pending request doc."""
        now = datetime.now(timezone.utc)

        @firestore.transactional
        def _assign_slot(transaction):
            snapshot = self._pacing_ref.get(transaction=transaction)
            last_scheduled_time = (
                snapshot.to_dict().get('last_scheduled_time') if snapshot.exists else None
            )
            scheduled_time = next_slot(last_scheduled_time, now)
            transaction.set(self._pacing_ref, {'last_scheduled_time': scheduled_time})
            return scheduled_time

        scheduled_time = _assign_slot(self._client.transaction())

        # Best-effort position among currently pending requests. Like the
        # old get_queue_contents(), this is approximate under concurrent
        # requests -- it's a display number, not what the bridge uses to
        # decide dispatch order (that's scheduled_time on each doc).
        queue_position = self._pending_count() + 1
        estimated_wait = int((scheduled_time - now).total_seconds())
        request_id = f"{username}_{int(time.time())}_{uuid.uuid4().hex[:8]}"

        self._requests.document().set({
            'request_id': request_id,
            'username': username,
            'r': r,
            'g': g,
            'b': b,
            'status': STATUS_PENDING,
            'scheduled_time': scheduled_time,
            'created_at': now,
            # Explicitly null, never omitted: order_by drops docs missing the
            # field, which would silently break get_current_username().
            'processed_at': None,
        })

        logger.info(
            f"Queued color request from {username}: RGB({r}, {g}, {b}) - "
            f"Position: {queue_position}, Wait: {estimated_wait}s"
        )

        return {
            'request_id': request_id,
            'scheduled_time': scheduled_time,
            'queue_position': queue_position,
            'estimated_wait_seconds': estimated_wait,
        }

    def get_queue_status(self) -> dict:
        """Get current queue status."""
        now = datetime.now(timezone.utc)
        pacing = self._pacing_ref.get()
        last_scheduled_time = pacing.to_dict().get('last_scheduled_time') if pacing.exists else None
        next_available = max(last_scheduled_time, now) if last_scheduled_time else now

        return {
            'queue_size': self._pending_count(),
            'worker_running': self.get_bridge_status()['bridge_online'],
            'next_available_slot': next_available.isoformat(),
            'estimated_wait_for_new_request': int((next_available - now).total_seconds()) + SLOT_SECONDS,
        }

    def get_queue_contents(self, limit: Optional[int] = None) -> list:
        """List pending requests, ordered by scheduled_time."""
        now = datetime.now(timezone.utc)
        query = self._requests.where('status', '==', STATUS_PENDING).order_by('scheduled_time')

        contents = []
        stream = query.limit(limit).stream() if limit else query.stream()
        for position, doc in enumerate(stream, start=1):
            data = doc.to_dict()
            scheduled_time = data['scheduled_time']
            contents.append({
                'request_id': data['request_id'],
                'username': data['username'],
                'scheduled_time': scheduled_time.isoformat(),
                'queue_position': position,
                'estimated_wait_seconds': max(0, int((scheduled_time - now).total_seconds())),
            })
        return contents

    def cancel_request(self, request_id: str) -> int:
        """Cancel one pending request by its unique request ID."""
        docs = list(
            self._requests
            .where('request_id', '==', request_id)
            .where('status', '==', STATUS_PENDING)
            .limit(1)
            .stream()
        )
        if not docs:
            return 0

        docs[0].reference.update({'status': STATUS_CANCELLED})
        logger.info(f"Cancelled pending request '{request_id}'")
        return 1

    def clear_queue(self) -> int:
        """Cancel all pending requests and reset the pacing clock."""
        docs = list(self._requests.where('status', '==', STATUS_PENDING).stream())

        batch = self._client.batch()
        for doc in docs:
            batch.update(doc.reference, {'status': STATUS_CANCELLED})
        if docs:
            batch.commit()

        self._pacing_ref.set({'last_scheduled_time': datetime.now(timezone.utc)})

        logger.info(f"Cleared {len(docs)} requests from queue and reset timing")
        return len(docs)

    def get_bridge_status(self) -> dict:
        """Report bridge liveness from its heartbeat doc."""
        snapshot = self._bridge_ref.get()
        if not snapshot.exists:
            return {'bridge_online': False, 'serial_connected': None, 'serial_port': None}

        data = snapshot.to_dict()
        last_seen = data.get('last_seen')
        online = bool(last_seen) and (
            datetime.now(timezone.utc) - last_seen
        ).total_seconds() < BRIDGE_STALE_SECONDS

        return {
            'bridge_online': online,
            'serial_connected': data.get('serial_connected') if online else None,
            'serial_port': data.get('serial_port') if online else None,
        }


    # ------------------------------------------------------------------
    # Admin: clearing the currently displayed user.
    # See docs/admin-clear-current.md for the design.
    # ------------------------------------------------------------------

    def get_current_username(self) -> Optional[str]:
        """Whoever the OBS overlay is showing, or None.

        The newest processed_at is what viewers see; unprocessed docs hold null,
        which sorts lowest. None when nothing is displayed or already redacted,
        which is what makes a repeated clear a no-op.
        """
        query = (
            self._requests
            .order_by('processed_at', direction=firestore.Query.DESCENDING)
            .limit(1)
        )
        for doc in query.stream():
            data = doc.to_dict() or {}
            if data.get('processed_at') is None:
                return None  # nothing dispatched yet
            username = data.get('username')
            if username == REDACTED_USERNAME:
                return None
            return username
        return None

    def cancel_pending_for_user(self, username: str) -> int:
        """Cancel only this user's pending requests, leaving everyone else's."""
        docs = list(
            self._requests
            .where('username', '==', username)
            .where('status', '==', STATUS_PENDING)
            .stream()
        )
        if not docs:
            return 0

        batch = self._client.batch()
        for doc in docs:
            batch.update(doc.reference, {'status': STATUS_CANCELLED})
        batch.commit()

        logger.info(f"Cancelled {len(docs)} pending request(s) for '{username}'")
        return len(docs)

    def redact_username(self, username: str) -> int:
        """Overwrite the name on this user's docs so the log stops carrying it."""
        docs = list(self._requests.where('username', '==', username).stream())
        if not docs:
            return 0

        batch = self._client.batch()
        for doc in docs:
            batch.update(doc.reference, {'username': REDACTED_USERNAME})
        batch.commit()

        logger.info(f"Redacted username on {len(docs)} document(s)")
        return len(docs)

    def request_overlay_clear(self) -> None:
        """Ask the bridge to blank the overlay.

        The cloud cannot reach the home machine, so this is a command doc the
        bridge watches. Written only here; the bridge only reads it.
        """
        self._overlay_ref.set({'clear_requested_at': firestore.SERVER_TIMESTAMP})
        logger.info("Requested overlay clear")

    @staticmethod
    def _denylist_id(username: str) -> str:
        """Hash, so the offensive string is never stored after redaction."""
        return hashlib.sha256(username.strip().lower().encode('utf-8')).hexdigest()

    def block_username(self, username: str) -> None:
        self._denylist.document(self._denylist_id(username)).set(
            {'blocked_at': firestore.SERVER_TIMESTAMP}
        )
        logger.info("Added a username to the denylist")

    def is_blocked(self, username: str) -> bool:
        return self._denylist.document(self._denylist_id(username)).get().exists

    def get_queue_size(self) -> int:
        """Number of pending requests. One aggregated read, not one per doc."""
        return self._pending_count()

    def _pending_count(self) -> int:
        # count() is a server-side aggregation: it bills a single read for the
        # whole tally instead of streaming every pending doc back to count them.
        result = self._requests.where('status', '==', STATUS_PENDING).count().get()
        return int(result[0][0].value)
