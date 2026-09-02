"""Shared constants for the RGBoo cloud API and the home-machine bridge.

Keeping these in one module ensures the Cloud Run API and the bridge agree
on Firestore collection names, status values, and pacing timing.
"""

# One color change per slot, matching middleware/color_queue.py.
SLOT_SECONDS = 20

# The bridge beats every 60s; older than this counts as offline.
BRIDGE_STALE_SECONDS = 120

REQUESTS_COLLECTION = "requests"
META_COLLECTION = "meta"
PACING_DOC = "pacing"
BRIDGE_DOC = "bridge"

# Admin clear command: written only by the API, watched only by the bridge.
OVERLAY_CONTROL_DOC = "overlay_control"

# Keyed by sha256 of the name, so blocking doesn't undo redaction.
DENYLIST_COLLECTION = "denylist"

# Also the marker that makes a repeated admin clear a no-op.
REDACTED_USERNAME = "[redacted]"

# Must match middleware/obs.py, which the bridge reuses unchanged.
DEFAULT_OBS_USERNAME = "Waiting for user..."

STATUS_PENDING = "pending"
STATUS_DONE = "done"
STATUS_CANCELLED = "cancelled"
STATUS_FAILED = "failed"
