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

# ---------------------------------------------------------------------------
# 30-day colour stats (docs/stats-aggregates.md)
# ---------------------------------------------------------------------------

# One aggregate document per local day: stats_daily/{YYYY-MM-DD}.
STATS_DAILY_COLLECTION = "stats_daily"

# Days are bucketed in the stream's local time, not UTC -- "8pm on the
# stream" has to land in the 8pm cell. Changing this invalidates existing
# aggregates, so a change means re-running scripts/rollup_stats.py.
STATS_TIMEZONE = "America/New_York"

# Hues are binned into 12 x 30 degrees, each bin *centred* on its label's
# canonical hue, so pure red (0 degrees) sits in the middle of "red" rather
# than on the boundary between red and rose.
HUE_BUCKET_COUNT = 12
HUE_BUCKET_DEGREES = 360 // HUE_BUCKET_COUNT
HUE_BUCKET_LABELS = (
    "red", "orange", "yellow", "chartreuse",
    "green", "spring green", "cyan", "azure",
    "blue", "violet", "magenta", "rose",
)

# Colours with too little colourfulness or lightness have no meaningful hue,
# so they get their own bins instead of being scattered across all twelve.
BUCKET_DARK = "dark"
BUCKET_NEUTRAL = "neutral"
DARK_LIGHTNESS_MAX = 0.10
# Chroma (max channel minus min), not HLS saturation. Saturation divides by
# a term that vanishes at the extremes, so it reports 1.0 for #fff8f8 -- a
# near-white -- and would file it as a fully saturated red. Chroma reports
# 0.03 for the same colour, which is what the eye says.
NEUTRAL_CHROMA_MAX = 0.10

# Guard rails for GET /api/stats?days=
STATS_MIN_DAYS = 1
STATS_MAX_DAYS = 90
STATS_DEFAULT_DAYS = 30
