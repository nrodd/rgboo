import logging

from google.cloud import firestore

logger = logging.getLogger(__name__)

_client = None


def get_firestore_client() -> firestore.Client:
    """Return a process-wide Firestore client, created lazily on first use."""
    global _client
    if _client is None:
        _client = firestore.Client()
        logger.info("Firestore client initialized")
    return _client
