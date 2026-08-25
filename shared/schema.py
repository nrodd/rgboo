"""Shared constants for the RGBoo cloud API and the home-machine bridge.

Keeping these in one module ensures the Cloud Run API and the bridge agree
on Firestore collection names, status values, and pacing timing.
"""

# One color change is dispatched every SLOT_SECONDS, matching the pacing in
# the original in-process queue (middleware/color_queue.py: timer = 20).
SLOT_SECONDS = 20

# The bridge writes a heartbeat to meta/bridge every 60s; a heartbeat older
# than this is treated as the bridge being offline.
BRIDGE_STALE_SECONDS = 120

REQUESTS_COLLECTION = "requests"
META_COLLECTION = "meta"
PACING_DOC = "pacing"
BRIDGE_DOC = "bridge"

STATUS_PENDING = "pending"
STATUS_DONE = "done"
STATUS_CANCELLED = "cancelled"
STATUS_FAILED = "failed"
