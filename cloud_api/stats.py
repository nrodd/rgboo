"""Daily colour aggregates: the write side (rollup) and the read side.

The `requests` collection is an append-only log -- nothing in the system
ever deletes a request doc, and `done` is terminal -- so these aggregates
are pure derived data. That is what lets the rollup be an occasional
offline command (scripts/rollup_stats.py) instead of a scheduled job:
running it once before publishing the stats page produces exactly the
same numbers as having run it hourly all along.

Reading the raw log on every page view is what we are avoiding. A busy
month is tens of thousands of request docs; a month of aggregates is at
most 31, fetched in a single round trip.

See docs/stats-heatmap.md.
"""

import logging
import time
from datetime import date, datetime, timedelta, timezone
from typing import Optional

from google.cloud import firestore

from shared.schema import (
    REQUESTS_COLLECTION,
    STATS_DAILY_COLLECTION,
    STATS_TIMEZONE,
    STATUS_DONE,
)

from . import buckets

logger = logging.getLogger(__name__)

# Aggregates only change when the rollup command is run by hand, so this
# can be generous. It exists to stop a burst of page views turning into a
# Firestore read each.
CACHE_TTL_SECONDS = 300

# Firestore caps a batch at 500 writes.
_BATCH_LIMIT = 400

# How many entries the top-colours list carries.
_TOP_COLORS = 6


class StatsStore:
    """Reads and rebuilds the stats_daily aggregates."""

    def __init__(self, client: firestore.Client, cache_ttl: int = CACHE_TTL_SECONDS):
        self._client = client
        self._requests = client.collection(REQUESTS_COLLECTION)
        self._daily = client.collection(STATS_DAILY_COLLECTION)
        self._cache_ttl = cache_ttl
        self._cache: dict = {}

    # ------------------------------------------------------------------
    # Write side: rebuild aggregates from the request log.
    # ------------------------------------------------------------------

    def rollup(self, start: date, end: date) -> dict:
        """Rebuild the stats_daily docs covering [start, end] inclusive.

        Idempotent: each day doc is overwritten with a full recount rather
        than incremented, so running this twice, or over an overlapping
        range, converges on the same answer. That is also why it doubles
        as the repair tool.

        Days with no dispatched colours are left without a document. A day
        can only ever gain requests -- `done` is terminal and request docs
        are never deleted -- so "no rows today" always means "nothing ever
        happened today", never "the data went away".
        """
        if start > end:
            raise ValueError("start date must not be after end date")

        rows = list(self._iter_done(start, end))
        days = buckets.accumulate(rows)

        written = 0
        batch = self._client.batch()
        for day_id, day in sorted(days.items()):
            batch.set(self._daily.document(day_id), {
                'date': day_id,
                'count': day['count'],
                'hours': day['hours'],
                'timezone': STATS_TIMEZONE,
                'updated_at': firestore.SERVER_TIMESTAMP,
            })
            written += 1
            if written % _BATCH_LIMIT == 0:
                batch.commit()
                batch = self._client.batch()
        if written % _BATCH_LIMIT:
            batch.commit()

        self._cache.clear()
        logger.info(
            "Rolled up %d dispatched requests into %d day(s), %s to %s",
            len(rows), written, start.isoformat(), end.isoformat(),
        )
        return {
            'start_date': start.isoformat(),
            'end_date': end.isoformat(),
            'requests_counted': len(rows),
            'days_written': written,
        }

    def _iter_done(self, start: date, end: date):
        """Stream (processed_at, r, g, b) for dispatched requests in range.

        Bounded by local midnight either side, so a day means the same
        thing here as it does in the heatmap. Needs the composite index on
        (status ASC, processed_at ASC) -- see docs/stats-heatmap.md.
        """
        start_at = buckets.local_midnight(start)
        end_at = buckets.local_midnight(end + timedelta(days=1))

        query = (
            self._requests
            .where('status', '==', STATUS_DONE)
            .where('processed_at', '>=', start_at)
            .where('processed_at', '<', end_at)
        )

        for doc in query.stream():
            data = doc.to_dict() or {}
            processed_at = data.get('processed_at')
            if processed_at is None:
                # Can't happen for a done doc, but a malformed row must not
                # take the whole rollup down.
                logger.warning("Skipping done request %s with no processed_at", doc.id)
                continue
            try:
                yield processed_at, int(data['r']), int(data['g']), int(data['b'])
            except (KeyError, TypeError, ValueError) as error:
                logger.warning("Skipping malformed request %s: %s", doc.id, error)

    # ------------------------------------------------------------------
    # Read side: what GET /api/stats returns.
    # ------------------------------------------------------------------

    def read_range(self, days: int) -> dict:
        """The last `days` local days of aggregates, shaped for the page."""
        cached = self._cache.get(days)
        if cached and cached[0] > time.monotonic():
            return cached[1]

        today = datetime.now(timezone.utc).astimezone(buckets.STATS_TZ).date()
        dates = buckets.day_range(today, days)
        payload = self._build(dates, self._fetch(dates))

        self._cache[days] = (time.monotonic() + self._cache_ttl, payload)
        return payload

    def _fetch(self, dates: list) -> dict:
        """One round trip for the whole range, keyed by day id.

        get_all makes no promise about ordering, so the result is indexed
        by document id rather than zipped against the input.
        """
        refs = [self._daily.document(day.isoformat()) for day in dates]
        found = {}
        for snapshot in self._client.get_all(refs):
            if snapshot.exists:
                found[snapshot.id] = snapshot.to_dict() or {}
        return found

    def _build(self, dates: list, found: dict) -> dict:
        grid = []
        totals = {}
        hour_totals = [0] * 24
        total_count = 0
        active_days = 0
        busiest_day = None
        updated_at = None

        for day in dates:
            day_id = day.isoformat()
            data = found.get(day_id, {})
            day_count = int(data.get('count', 0))
            total_count += day_count
            if day_count:
                active_days += 1
            if busiest_day is None or day_count > busiest_day['count']:
                busiest_day = {'date': day_id, 'count': day_count}

            stamp = data.get('updated_at')
            if stamp is not None and (updated_at is None or stamp > updated_at):
                updated_at = stamp

            hours = []
            for hour_key, hour in (data.get('hours') or {}).items():
                index = int(hour_key)
                count = int(hour.get('n', 0))
                if count <= 0:
                    continue
                hour_totals[index] += count
                buckets.merge_buckets(totals, hour.get('buckets') or {})

                cell = {'h': index, 'n': count}
                top = buckets.dominant(hour.get('buckets') or {})
                if top:
                    cell['hex'] = buckets.bucket_hex(top[1])
                    cell['label'] = buckets.bucket_label(top[0])
                hours.append(cell)

            # Sorted so the client can render straight through without
            # caring what order Firestore returned the map keys in.
            hours.sort(key=lambda cell: cell['h'])
            grid.append({'date': day_id, 'count': day_count, 'hours': hours})

        peak = max(hour_totals) if total_count else 0
        busiest_hour = (
            {'hour': hour_totals.index(peak), 'count': peak} if peak else None
        )
        # Averaged over days that actually had a stream, not over the whole
        # window -- a month with three busy nights isn't a 12-per-day month.
        avg = round(total_count / active_days, 1) if active_days else 0

        return {
            'timezone': STATS_TIMEZONE,
            'days': len(dates),
            'start_date': dates[0].isoformat(),
            'end_date': dates[-1].isoformat(),
            'generated_at': datetime.now(timezone.utc).isoformat(),
            'updated_at': _isoformat(updated_at),
            'totals': {
                'count': total_count,
                'active_days': active_days,
                'avg_per_active_day': avg,
                'busiest_day': busiest_day if total_count else None,
                'busiest_hour': busiest_hour,
                'peak_hour_count': max(
                    (cell['n'] for day in grid for cell in day['hours']), default=0
                ),
                'top_colors': buckets.rank_buckets(totals, _TOP_COLORS),
            },
            'grid': grid,
        }


def _isoformat(value) -> Optional[str]:
    return value.isoformat() if hasattr(value, 'isoformat') else None
