"""One Firestore client factory shared by the API and local bridge.

The Google client automatically uses ``FIRESTORE_EMULATOR_HOST`` when it is
set. The development launcher sets that variable before either process starts,
which makes the local database choice explicit and keeps credentials out of
the local workflow.
"""

import logging
import os

from google.cloud import firestore

logger = logging.getLogger(__name__)

_client = None


def get_firestore_client() -> firestore.Client:
    """Return a process-wide Firestore client for the configured project."""
    global _client
    if _client is None:
        project = os.getenv('GOOGLE_CLOUD_PROJECT')
        _client = firestore.Client(project=project) if project else firestore.Client()
        target = os.getenv('FIRESTORE_EMULATOR_HOST')
        if target:
            logger.info("Firestore client initialized against emulator at %s", target)
        else:
            logger.info("Firestore client initialized")
    return _client
