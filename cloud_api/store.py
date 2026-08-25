"""Firestore-backed color-request queue and pacing clock.

Mirrors the interface of the old in-process ColorQueue
(middleware/color_queue.py) so cloud_api/routes.py ports over almost
unchanged, and so tests can swap in a fake/mock store.
"""

import logging
import time
import uuid
from datetime import datetime, timezone

from google.cloud import firestore

from shared.schema import (
    BRIDGE_DOC,
    BRIDGE_STALE_SECONDS,
    META_COLLECTION,
    PACING_DOC,
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

    def get_queue_contents(self) -> list:
        """List pending requests, ordered by scheduled_time."""
        now = datetime.now(timezone.utc)
        query = self._requests.where('status', '==', STATUS_PENDING).order_by('scheduled_time')

        contents = []
        for position, doc in enumerate(query.stream(), start=1):
            data = doc.to_dict()
            scheduled_time = data['scheduled_time']
            contents.append({
                'username': data['username'],
                'scheduled_time': scheduled_time.isoformat(),
                'queue_position': position,
                'estimated_wait_seconds': max(0, int((scheduled_time - now).total_seconds())),
            })
        return contents

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

    def _pending_count(self) -> int:
        docs = self._requests.where('status', '==', STATUS_PENDING).select([]).stream()
        return sum(1 for _ in docs)
