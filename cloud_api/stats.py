"""Daily colour aggregates: the write side (rollup) and the read side.

The aggregates are pure derived data -- `requests` is append-only and `done` is
terminal -- so the rollup is an offline command (scripts/rollup_stats.py)
rather than a scheduled job. See stats_daily in docs/architecture.md.
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

# Aggregates only move when the rollup is run by hand, so this can be
# generous. It stops a burst of page views becoming a Firestore read each.
CACHE_TTL_SECONDS = 300

# Firestore caps a batch at 500 writes.
_BATCH_LIMIT = 400

# Most squares the mosaic will ever be sent. A 24/7 month runs to six figures,
# which is neither renderable nor a sensible payload. Thinned by taking every
# Nth, so the month keeps its shape end to end rather than only its tail.
MAX_SEQUENCE = 4000


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

        Idempotent: each day is a full recount written with set(), never an
        increment, so re-running over the same or an overlapping range
        converges. Days with no dispatched colours get no document.
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
                # Every colour that day in dispatch order, rounded to
                # SWATCH_STEP. This is what the mosaic draws.
                'sequence': day['sequence'],
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

        Bounded by local midnight either side, so a day means the same thing
        here as it does on the page. Needs the composite index on
        (status ASC, processed_at ASC) -- see docs/architecture.md.
        """
        start_at = buckets.local_midnight(start)
        end_at = buckets.local_midnight(end + timedelta(days=1))

        # Ordered explicitly: accumulate() records dispatch order, and the
        # implicit ordering of an inequality filter is not a promise.
        query = (
            self._requests
            .where('status', '==', STATUS_DONE)
            .where('processed_at', '>=', start_at)
            .where('processed_at', '<', end_at)
            .order_by('processed_at')
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
        """Shape the aggregates into the payload the page draws.

        Every bin a day saw is reported with its own count, so nothing a
        busy hour recorded is discarded on the way out.
        """
        grid = []
        range_buckets: dict = {}
        sequence: list = []
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

            # Hours collapse two ways: into the range's hour-of-day profile,
            # and into this day's per-colour totals.
            day_buckets: dict = {}
            for hour_key, hour in (data.get('hours') or {}).items():
                count = int(hour.get('n', 0))
                if count <= 0:
                    continue
                try:
                    hour_totals[int(hour_key)] += count
                except (ValueError, IndexError):
                    # A hand-edited or stale doc must not 500 the whole page.
                    logger.warning("Skipping hour key %r on %s", hour_key, day_id)
                    continue
                buckets.merge_buckets(day_buckets, hour.get('buckets') or {})

            # Days are walked oldest first, so appending keeps the whole
            # range in dispatch order.
            sequence.extend(data.get('sequence') or [])

            buckets.merge_buckets(range_buckets, day_buckets)
            colors = {
                key: int(bucket['n'])
                for key, bucket in day_buckets.items()
                if int(bucket.get('n', 0)) > 0
            }
            grid.append({'date': day_id, 'count': day_count, 'colors': colors})

        # Thin by taking every Nth rather than the last N, so a long month
        # keeps its shape from end to end instead of only its tail.
        step = max(1, -(-len(sequence) // MAX_SEQUENCE))
        shown = sequence[::step]

        peak_hour = max(hour_totals) if total_count else 0
        busiest_hour = (
            {'hour': hour_totals.index(peak_hour), 'count': peak_hour} if peak_hour else None
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
                # Always all 24, so a quiet hour reads as a finding.
                'hours': [{'h': hour, 'n': hour_totals[hour]} for hour in range(24)],
                # The 14 coarse families, busiest first: the summary bar.
                'colors': buckets.rank_buckets(range_buckets),
                # Every colour picked, in the order it was picked: the mosaic.
                'sequence': [f'#{key}' for key in shown],
                'sampled': len(shown) < len(sequence),
            },
            'grid': grid,
        }


def _isoformat(value) -> Optional[str]:
    return value.isoformat() if hasattr(value, 'isoformat') else None
