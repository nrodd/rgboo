"""Pure bucketing math for the 30-day colour stats.

Kept separate from stats.py exactly as pacing.py is kept separate from
store.py: no Firestore, no ambient clock, so every edge case here is a
plain unit test.

The shape this produces is what a stats_daily document stores:

    hours["20"]["buckets"]["3"] == {"n": 9, "r": 1834, "g": 612, "b": 90}

Sums rather than an average, because sums are what a rollup can keep
adding to. The average is taken at read time, and only *within* one hue
bin -- averaging across bins turns a day of red and blue into mud.
"""

import colorsys
from datetime import date, datetime, timedelta
from typing import Iterable, Optional
from zoneinfo import ZoneInfo

from shared.schema import (
    BUCKET_DARK,
    BUCKET_NEUTRAL,
    DARK_LIGHTNESS_MAX,
    HUE_BUCKET_COUNT,
    HUE_BUCKET_DEGREES,
    HUE_BUCKET_LABELS,
    NEUTRAL_SATURATION_MAX,
    STATS_TIMEZONE,
)

STATS_TZ = ZoneInfo(STATS_TIMEZONE)


def to_local(moment: datetime) -> datetime:
    """Move a timestamp into the stream's local timezone.

    Firestore hands back timezone-aware UTC datetimes. A naive one can only
    come from a test or a hand-built doc; treat it as UTC rather than
    letting astimezone() silently interpret it as the host's local time.
    """
    if moment.tzinfo is None:
        moment = moment.replace(tzinfo=ZoneInfo("UTC"))
    return moment.astimezone(STATS_TZ)


def day_key(moment: datetime) -> str:
    """The stats_daily document id a timestamp belongs to."""
    return to_local(moment).date().isoformat()


def hour_key(moment: datetime) -> str:
    """The hours map key a timestamp belongs to, "0" through "23"."""
    return str(to_local(moment).hour)


def day_range(end: date, days: int) -> list:
    """The `days` local dates ending at (and including) `end`, oldest first."""
    return [end - timedelta(days=offset) for offset in range(days - 1, -1, -1)]


def local_midnight(day: date) -> datetime:
    """Start of a local day, as an aware datetime.

    Used to turn a date range into the timestamp bounds of a Firestore
    query. On the spring-forward date midnight still exists, so there is no
    non-existent-time case to handle here.
    """
    return datetime(day.year, day.month, day.day, tzinfo=STATS_TZ)


def hue_bucket(r: int, g: int, b: int) -> str:
    """The bin key a colour belongs to.

    Near-black and near-grey have no useful hue -- a hue is still computed
    for them, but it is numerically unstable, so they would smear randomly
    across all twelve bins. They get their own keys instead.
    """
    hue, lightness, saturation = colorsys.rgb_to_hls(r / 255, g / 255, b / 255)

    if lightness < DARK_LIGHTNESS_MAX:
        return BUCKET_DARK
    if saturation < NEUTRAL_SATURATION_MAX:
        return BUCKET_NEUTRAL

    degrees = hue * 360
    # The +half-bin rotation is what centres each bin on its label's hue.
    half_bin = HUE_BUCKET_DEGREES / 2
    index = int(((degrees + half_bin) % 360) // HUE_BUCKET_DEGREES)
    return str(index % HUE_BUCKET_COUNT)


def bucket_label(key: str) -> str:
    """Human name for a bin key, for the top-colours list."""
    if key == BUCKET_DARK:
        return "near black"
    if key == BUCKET_NEUTRAL:
        return "white / grey"
    try:
        return HUE_BUCKET_LABELS[int(key)]
    except (ValueError, IndexError):
        return "unknown"


def add_sample(buckets: dict, r: int, g: int, b: int) -> dict:
    """Fold one colour into a bucket map, in place."""
    key = hue_bucket(r, g, b)
    bucket = buckets.setdefault(key, {"n": 0, "r": 0, "g": 0, "b": 0})
    bucket["n"] += 1
    bucket["r"] += r
    bucket["g"] += g
    bucket["b"] += b
    return buckets


def merge_buckets(target: dict, source: dict) -> dict:
    """Fold one bucket map into another, in place. Used to total a range."""
    for key, bucket in source.items():
        into = target.setdefault(key, {"n": 0, "r": 0, "g": 0, "b": 0})
        for field in ("n", "r", "g", "b"):
            into[field] += int(bucket.get(field, 0))
    return target


def bucket_hex(bucket: dict) -> Optional[str]:
    """The mean colour of one bin, as #rrggbb, or None if the bin is empty."""
    count = int(bucket.get("n", 0))
    if count <= 0:
        return None

    def channel(name: str) -> int:
        return max(0, min(255, round(int(bucket.get(name, 0)) / count)))

    return "#{:02x}{:02x}{:02x}".format(channel("r"), channel("g"), channel("b"))


def dominant(buckets: dict) -> Optional[tuple]:
    """The busiest bin as (key, bucket), or None when there are no samples.

    Ties break on the bin key so the same data always renders the same
    colour -- a heatmap cell that flickers between two shades on identical
    input reads as a bug.
    """
    populated = [
        (key, bucket) for key, bucket in buckets.items() if int(bucket.get("n", 0)) > 0
    ]
    if not populated:
        return None
    return max(populated, key=lambda item: (int(item[1]["n"]), _tie_break(item[0])))


def _tie_break(key: str):
    """Order bin keys deterministically: numeric hues first, then the rest."""
    try:
        return (0, -int(key))
    except ValueError:
        return (-1, key)


def rank_buckets(buckets: dict, limit: int) -> list:
    """The `limit` busiest bins, as the API's top_colors entries."""
    total = sum(int(bucket.get("n", 0)) for bucket in buckets.values())
    if not total:
        return []

    ordered = sorted(
        (item for item in buckets.items() if int(item[1].get("n", 0)) > 0),
        key=lambda item: (int(item[1]["n"]), _tie_break(item[0])),
        reverse=True,
    )
    return [
        {
            "key": key,
            "label": bucket_label(key),
            "hex": bucket_hex(bucket),
            "count": int(bucket["n"]),
            "share": round(int(bucket["n"]) / total, 4),
        }
        for key, bucket in ordered[:limit]
    ]


def accumulate(samples: Iterable[tuple]) -> dict:
    """Build day -> hour -> bucket totals from (processed_at, r, g, b) rows.

    Returns the exact `hours` map a stats_daily document stores, keyed by
    day, plus a per-day count. Days with no samples are simply absent.
    """
    days: dict = {}
    for moment, r, g, b in samples:
        day = days.setdefault(day_key(moment), {"count": 0, "hours": {}})
        hour = day["hours"].setdefault(hour_key(moment), {"n": 0, "buckets": {}})
        day["count"] += 1
        hour["n"] += 1
        add_sample(hour["buckets"], r, g, b)
    return days
