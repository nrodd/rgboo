"""Firestore access for the bridge: read pending requests, close them out.

The cloud API's RequestStore (cloud_api/store.py) owns the write side of
the queue -- pacing and creating pending docs. This is the read/complete
side, and it is deliberately the only module in the bridge that knows
what Firestore looks like, so the processing loop can be tested with a
plain mock.
"""

import logging
from dataclasses import dataclass
from datetime import datetime
from typing import Callable, List, Optional

from google.cloud import firestore

from shared.schema import (
    BRIDGE_DOC,
    META_COLLECTION,
    REQUESTS_COLLECTION,
    STATUS_DONE,
    STATUS_FAILED,
    STATUS_PENDING,
)

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class ColorRequest:
    """One request doc, in the shape the processing loop cares about."""

    doc_id: str
    request_id: str
    username: str
    r: int
    g: int
    b: int
    status: str
    scheduled_time: datetime


def to_color_request(doc) -> Optional[ColorRequest]:
    """Convert a Firestore snapshot to a ColorRequest, or None if unusable.

    A malformed doc must never take the daemon down, so anything missing
    the fields we need is logged and skipped instead of raising.
    """
    data = doc.to_dict() or {}
    try:
        return ColorRequest(
            doc_id=doc.id,
            request_id=data.get('request_id', doc.id),
            username=data['username'],
            r=int(data['r']),
            g=int(data['g']),
            b=int(data['b']),
            status=data.get('status', STATUS_PENDING),
            scheduled_time=data['scheduled_time'],
        )
    except (KeyError, TypeError, ValueError) as e:
        logger.error(f"Skipping malformed request doc {doc.id}: {e}")
        return None


class BridgeStore:
    """Everything the bridge needs from Firestore."""

    def __init__(self, client: firestore.Client):
        self._client = client
        self._requests = client.collection(REQUESTS_COLLECTION)
        self._bridge_ref = client.collection(META_COLLECTION).document(BRIDGE_DOC)

    def _pending_query(self):
        # No order_by here (unlike cloud_api's get_queue_contents): sorting
        # by scheduled_time locally keeps this a single-field query, which
        # needs no composite index and works as an on_snapshot target.
        return self._requests.where('status', '==', STATUS_PENDING)

    def list_pending(self) -> List[ColorRequest]:
        """One-shot read of every pending request."""
        requests = (to_color_request(doc) for doc in self._pending_query().stream())
        return [request for request in requests if request is not None]

    def watch_pending(self, on_snapshot: Callable):
        """Subscribe to pending requests; returns the watch handle.

        The gRPC stream is outbound, so this works from behind home NAT
        with no port forwarding.
        """
        return self._pending_query().on_snapshot(on_snapshot)

    def reload(self, doc_id: str) -> Optional[ColorRequest]:
        """Re-read a request doc; None if it no longer exists.

        Called immediately before the serial write so a request cancelled
        via POST /api/queue/clear after being queued is still skipped.
        """
        snapshot = self._requests.document(doc_id).get()
        if not snapshot.exists:
            return None
        return to_color_request(snapshot)

    def mark_done(self, doc_id: str) -> None:
        self._set_status(doc_id, STATUS_DONE)

    def mark_failed(self, doc_id: str, error: str) -> None:
        self._set_status(doc_id, STATUS_FAILED, error=error)

    def write_heartbeat(self, serial_connected: bool, serial_port: Optional[str]) -> None:
        """Publish liveness for the cloud API's GET / and /api/status.

        SERVER_TIMESTAMP rather than the local clock, so a skewed home
        machine can't make itself look permanently stale (or fresh).
        """
        self._bridge_ref.set({
            'last_seen': firestore.SERVER_TIMESTAMP,
            'serial_connected': serial_connected,
            'serial_port': serial_port,
        })

    def _set_status(self, doc_id: str, status: str, error: Optional[str] = None) -> None:
        update = {'status': status, 'processed_at': firestore.SERVER_TIMESTAMP}
        if error is not None:
            update['error'] = error
        self._requests.document(doc_id).update(update)
