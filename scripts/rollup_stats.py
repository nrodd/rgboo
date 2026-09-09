#!/usr/bin/env python3
"""Rebuild the daily colour aggregates that GET /api/stats reads.

The only writer of the stats_daily collection, and deliberately an offline
command rather than a scheduled job -- docs/stats-aggregates.md says why.

Run it whenever you want the published page to catch up:

    python scripts/rollup_stats.py                 # last 30 local days
    python scripts/rollup_stats.py --days 90       # a wider window
    python scripts/rollup_stats.py --from 2026-09-01 --to 2026-09-30
    python scripts/rollup_stats.py --dry-run       # count, write nothing

It is idempotent -- re-running over the same range recomputes each day
from scratch -- so it is also the repair tool if an aggregate ever looks
wrong.

Against the emulator, set FIRESTORE_EMULATOR_HOST first (scripts/dev.sh
already does). Against production you need application-default
credentials and GOOGLE_CLOUD_PROJECT.
"""

import argparse
import logging
import os
import sys
from datetime import date, datetime, timedelta, timezone

# Run as a script from anywhere in the repo.
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from cloud_api import buckets  # noqa: E402
from cloud_api.stats import StatsStore  # noqa: E402
from shared.firestore_client import get_firestore_client  # noqa: E402
from shared.schema import STATS_DEFAULT_DAYS, STATS_TIMEZONE  # noqa: E402

logger = logging.getLogger('rollup_stats')


def _parse_date(value: str) -> date:
    try:
        return datetime.strptime(value, '%Y-%m-%d').date()
    except ValueError:
        raise argparse.ArgumentTypeError(f"expected YYYY-MM-DD, got '{value}'")


def _resolve_range(args) -> tuple:
    """Turn the CLI options into an inclusive [start, end] date pair."""
    today = datetime.now(timezone.utc).astimezone(buckets.STATS_TZ).date()
    end = args.to_date or today
    start = args.from_date or (end - timedelta(days=args.days - 1))
    if start > end:
        raise SystemExit(f"start date {start} is after end date {end}")
    return start, end


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    parser.add_argument(
        '--days', type=int, default=STATS_DEFAULT_DAYS,
        help=f'how many days back from today (default {STATS_DEFAULT_DAYS})',
    )
    parser.add_argument('--from', dest='from_date', type=_parse_date, help='start date, YYYY-MM-DD')
    parser.add_argument('--to', dest='to_date', type=_parse_date, help='end date, YYYY-MM-DD')
    parser.add_argument(
        '--dry-run', action='store_true',
        help='report what would be written without writing it',
    )
    parser.add_argument('-v', '--verbose', action='store_true')
    args = parser.parse_args(argv)

    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format='%(levelname)s %(message)s',
    )

    if args.days < 1:
        raise SystemExit('--days must be at least 1')

    start, end = _resolve_range(args)
    target = os.getenv('FIRESTORE_EMULATOR_HOST') or os.getenv('GOOGLE_CLOUD_PROJECT') or 'default project'
    logger.info("Rolling up %s to %s (%s) against %s", start, end, STATS_TIMEZONE, target)

    store = StatsStore(get_firestore_client())

    if args.dry_run:
        rows = list(store._iter_done(start, end))
        days = buckets.accumulate(rows)
        logger.info(
            "Dry run: %d dispatched request(s) across %d day(s); nothing written",
            len(rows), len(days),
        )
        for day_id, day in sorted(days.items()):
            logger.info("  %s  %4d colours across %d hour(s)", day_id, day['count'], len(day['hours']))
        return 0

    result = store.rollup(start, end)
    logger.info(
        "Wrote %d day(s) from %d dispatched request(s)",
        result['days_written'], result['requests_counted'],
    )
    if not result['days_written']:
        logger.warning("No dispatched requests in that range -- nothing to show yet")
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
