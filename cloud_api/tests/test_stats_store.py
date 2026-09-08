"""Tests for StatsStore: rebuilding aggregates, and reading them back."""

from datetime import date, datetime, timedelta, timezone

import pytest

from shared.schema import (
    REQUESTS_COLLECTION,
    STATS_DAILY_COLLECTION,
    STATUS_CANCELLED,
    STATUS_DONE,
    STATUS_PENDING,
)

from ..buckets import STATS_TZ
from ..stats import StatsStore
from .fake_firestore import FakeClient


def utc(year, month, day, hour=0, minute=0):
    return datetime(year, month, day, hour, minute, tzinfo=timezone.utc)


def request_doc(processed_at, r, g, b, status=STATUS_DONE):
    return {
        'username': 'guest',
        'r': r, 'g': g, 'b': b,
        'status': status,
        'processed_at': processed_at,
    }


@pytest.fixture()
def client():
    return FakeClient()


@pytest.fixture()
def store(client):
    return StatsStore(client, cache_ttl=0)


def daily(client):
    return client.collection(STATS_DAILY_COLLECTION).docs


# ---------------------------------------------------------------------------
# rollup
# ---------------------------------------------------------------------------

def test_rollup_records_each_distinct_colour_and_its_count(client, store):
    """The mosaic needs the colours themselves, not just family totals."""
    client.seed(REQUESTS_COLLECTION, 'a', request_doc(utc(2026, 9, 8, 16), 255, 0, 0))
    client.seed(REQUESTS_COLLECTION, 'b', request_doc(utc(2026, 9, 8, 17), 255, 0, 0))
    client.seed(REQUESTS_COLLECTION, 'c', request_doc(utc(2026, 9, 8, 18), 0, 0, 255))

    store.rollup(date(2026, 9, 8), date(2026, 9, 8))

    assert daily(client)['2026-09-08']['swatches'] == {'ff0000': 2, '0000ff': 1}


def test_rollup_rounds_imperceptibly_close_colours_together(client, store):
    """Bounds the per-day map without changing what anyone sees."""
    client.seed(REQUESTS_COLLECTION, 'a', request_doc(utc(2026, 9, 8, 16), 227, 104, 16))
    client.seed(REQUESTS_COLLECTION, 'b', request_doc(utc(2026, 9, 8, 17), 226, 105, 17))

    store.rollup(date(2026, 9, 8), date(2026, 9, 8))

    assert daily(client)['2026-09-08']['swatches'] == {'e06810': 2}


def test_rollup_writes_one_document_per_active_day(client, store):
    client.seed(REQUESTS_COLLECTION, 'a', request_doc(utc(2026, 9, 7, 23), 255, 0, 0))
    client.seed(REQUESTS_COLLECTION, 'b', request_doc(utc(2026, 9, 7, 23, 5), 250, 4, 4))
    client.seed(REQUESTS_COLLECTION, 'c', request_doc(utc(2026, 9, 8, 16), 0, 0, 255))

    result = store.rollup(date(2026, 9, 7), date(2026, 9, 8))

    assert result['requests_counted'] == 3
    assert result['days_written'] == 2
    assert set(daily(client)) == {'2026-09-07', '2026-09-08'}
    assert daily(client)['2026-09-07']['count'] == 2
    assert daily(client)['2026-09-07']['hours']['19']['buckets']['0']['n'] == 2


def test_rollup_only_counts_dispatched_colours(client, store):
    """Cancelled and still-pending requests never reached the LEDs."""
    client.seed(REQUESTS_COLLECTION, 'done', request_doc(utc(2026, 9, 8, 16), 255, 0, 0))
    client.seed(REQUESTS_COLLECTION, 'cancelled',
                request_doc(utc(2026, 9, 8, 16), 0, 255, 0, status=STATUS_CANCELLED))
    client.seed(REQUESTS_COLLECTION, 'pending',
                request_doc(None, 0, 0, 255, status=STATUS_PENDING))

    result = store.rollup(date(2026, 9, 8), date(2026, 9, 8))

    assert result['requests_counted'] == 1
    assert daily(client)['2026-09-08']['count'] == 1


def test_rollup_is_idempotent(client, store):
    client.seed(REQUESTS_COLLECTION, 'a', request_doc(utc(2026, 9, 8, 16), 255, 0, 0))

    store.rollup(date(2026, 9, 8), date(2026, 9, 8))
    first = dict(daily(client)['2026-09-08'])
    store.rollup(date(2026, 9, 8), date(2026, 9, 8))

    # A full recount, not an increment: running twice must not double it.
    assert daily(client)['2026-09-08']['count'] == first['count'] == 1


def test_rollup_recounts_rather_than_accumulating_stale_totals(client, store):
    client.seed(REQUESTS_COLLECTION, 'a', request_doc(utc(2026, 9, 8, 16), 255, 0, 0))
    store.rollup(date(2026, 9, 8), date(2026, 9, 8))

    client.seed(REQUESTS_COLLECTION, 'b', request_doc(utc(2026, 9, 8, 17), 0, 0, 255))
    store.rollup(date(2026, 9, 8), date(2026, 9, 8))

    assert daily(client)['2026-09-08']['count'] == 2
    assert set(daily(client)['2026-09-08']['hours']) == {'12', '13'}


def test_rollup_respects_local_day_boundaries(client, store):
    """23:00 UTC on the 9th is still the evening of the 8th on the stream."""
    client.seed(REQUESTS_COLLECTION, 'inside', request_doc(utc(2026, 9, 9, 3, 59), 255, 0, 0))
    client.seed(REQUESTS_COLLECTION, 'outside', request_doc(utc(2026, 9, 9, 4, 1), 255, 0, 0))

    store.rollup(date(2026, 9, 8), date(2026, 9, 8))

    assert set(daily(client)) == {'2026-09-08'}
    assert daily(client)['2026-09-08']['count'] == 1


def test_rollup_skips_days_with_nothing_dispatched(client, store):
    result = store.rollup(date(2026, 9, 1), date(2026, 9, 30))

    assert result['days_written'] == 0
    assert daily(client) == {}


def test_rollup_survives_a_malformed_request_doc(client, store):
    client.seed(REQUESTS_COLLECTION, 'good', request_doc(utc(2026, 9, 8, 16), 255, 0, 0))
    client.seed(REQUESTS_COLLECTION, 'bad', {
        'status': STATUS_DONE, 'processed_at': utc(2026, 9, 8, 17), 'r': 'orange',
    })

    result = store.rollup(date(2026, 9, 8), date(2026, 9, 8))

    assert result['requests_counted'] == 1


def test_rollup_rejects_a_backwards_range(store):
    with pytest.raises(ValueError):
        store.rollup(date(2026, 9, 8), date(2026, 9, 1))


def test_rollup_batches_a_long_range(client, store):
    """A 90-day backfill must not exceed Firestore's 500-write batch cap."""
    for offset in range(90):
        day = date(2026, 6, 1) + timedelta(days=offset)
        moment = datetime(day.year, day.month, day.day, 20, tzinfo=STATS_TZ)
        client.seed(REQUESTS_COLLECTION, f'r{offset}', request_doc(moment, 255, 0, 0))

    result = store.rollup(date(2026, 6, 1), date(2026, 8, 29))

    assert result['days_written'] == 90
    assert len(daily(client)) == 90


# ---------------------------------------------------------------------------
# read_range
# ---------------------------------------------------------------------------

def seed_day(client, day_id, hours, count=None, updated_at=None, swatches=None):
    total = count if count is not None else sum(hour['n'] for hour in hours.values())
    client.seed(STATS_DAILY_COLLECTION, day_id, {
        'date': day_id,
        'count': total,
        'hours': hours,
        'swatches': swatches or {},
        'updated_at': updated_at or utc(2026, 9, 8, 12),
    })


def test_read_range_returns_swatches_ordered_as_a_spectrum(client, store):
    today = _today()
    seed_day(
        client, today,
        {'20': {'n': 4, 'buckets': {'0': {'n': 4, 'r': 1020, 'g': 0, 'b': 0}}}},
        count=4,
        swatches={'0000ff': 1, '000000': 1, 'ff0000': 2, 'f8f8f8': 1},
    )

    swatches = store.read_range(1)['totals']['swatches']

    # Chromatic first around the wheel, then neutrals, then near-blacks.
    assert [s['hex'] for s in swatches] == ['#ff0000', '#0000ff', '#f8f8f8', '#000000']
    assert swatches[0]['n'] == 2


def test_read_range_sums_a_colour_across_days(client, store):
    today = _today()
    yesterday = (date.fromisoformat(today) - timedelta(days=1)).isoformat()
    hours = {'20': {'n': 1, 'buckets': {'0': {'n': 1, 'r': 255, 'g': 0, 'b': 0}}}}
    seed_day(client, yesterday, hours, swatches={'ff0000': 3})
    seed_day(client, today, hours, swatches={'ff0000': 5, '0000ff': 1})

    swatches = {s['hex']: s['n'] for s in store.read_range(2)['totals']['swatches']}

    assert swatches == {'#ff0000': 8, '#0000ff': 1}


def test_read_range_returns_a_cell_per_colour_per_day(client, store):
    seed_day(client, _today(), {
        '20': {'n': 4, 'buckets': {
            '0': {'n': 3, 'r': 765, 'g': 0, 'b': 0},
            '8': {'n': 1, 'r': 0, 'g': 0, 'b': 255},
        }},
        '21': {'n': 2, 'buckets': {'8': {'n': 2, 'r': 0, 'g': 0, 'b': 510}}},
    })

    payload = store.read_range(1)

    assert payload['totals']['count'] == 6
    # Hours collapse into per-colour day totals: blue appeared in both.
    assert payload['grid'][0]['colors'] == {'0': 3, '8': 3}


def test_read_range_keeps_every_colour_not_just_the_busiest(client, store):
    """The old grid showed each hour's winner only, discarding the rest."""
    seed_day(client, _today(), {
        '20': {'n': 12, 'buckets': {
            '0': {'n': 9, 'r': 2295, 'g': 0, 'b': 0},
            '8': {'n': 2, 'r': 0, 'g': 0, 'b': 510},
            '4': {'n': 1, 'r': 0, 'g': 255, 'b': 0},
        }},
    })

    payload = store.read_range(1)

    assert set(payload['grid'][0]['colors']) == {'0', '8', '4'}
    assert [row['label'] for row in payload['totals']['colors']] == ['red', 'blue', 'green']


def test_read_range_covers_days_with_no_document(client, store):
    payload = store.read_range(30)

    assert len(payload['grid']) == 30
    assert payload['totals']['count'] == 0
    assert payload['totals']['busiest_day'] is None
    assert payload['totals']['busiest_hour'] is None
    assert payload['totals']['colors'] == []
    assert payload['totals']['swatches'] == []
    assert payload['totals']['peak_color_day'] == 0
    assert all(day['colors'] == {} for day in payload['grid'])


def test_read_range_always_returns_a_full_24_hour_profile(client, store):
    seed_day(client, _today(), {'20': {'n': 3, 'buckets': {'0': {'n': 3, 'r': 765, 'g': 0, 'b': 0}}}})

    hours = store.read_range(1)['totals']['hours']

    assert [slot['h'] for slot in hours] == list(range(24))
    assert hours[20]['n'] == 3
    assert hours[3]['n'] == 0


def test_read_range_orders_the_grid_oldest_first(client, store):
    payload = store.read_range(5)

    dates = [day['date'] for day in payload['grid']]
    assert dates == sorted(dates)
    assert payload['start_date'] == dates[0]
    assert payload['end_date'] == dates[-1]


def test_read_range_reports_the_busiest_day_and_hour(client, store):
    today = _today()
    yesterday = (date.fromisoformat(today) - timedelta(days=1)).isoformat()
    seed_day(client, yesterday, {'20': {'n': 9, 'buckets': {'0': {'n': 9, 'r': 2295, 'g': 0, 'b': 0}}}})
    seed_day(client, today, {'20': {'n': 2, 'buckets': {'0': {'n': 2, 'r': 510, 'g': 0, 'b': 0}}}})

    totals = store.read_range(2)['totals']

    assert totals['busiest_day'] == {'date': yesterday, 'count': 9}
    assert totals['busiest_hour'] == {'hour': 20, 'count': 11}


def test_peak_color_day_is_the_busiest_single_cell_not_the_busiest_day(client, store):
    """It sets the grid's scale, so it must be a cell, not a day total."""
    seed_day(client, _today(), {
        '20': {'n': 30, 'buckets': {
            '0': {'n': 18, 'r': 4590, 'g': 0, 'b': 0},
            '8': {'n': 12, 'r': 0, 'g': 0, 'b': 3060},
        }},
    })

    totals = store.read_range(1)['totals']

    assert totals['busiest_day']['count'] == 30
    assert totals['peak_color_day'] == 18


def test_read_range_averages_over_active_days_only(client, store):
    seed_day(client, _today(), {'20': {'n': 10, 'buckets': {'0': {'n': 10, 'r': 2550, 'g': 0, 'b': 0}}}})

    totals = store.read_range(30)['totals']

    # 10 colours on one night is not "0.3 per day".
    assert totals['active_days'] == 1
    assert totals['avg_per_active_day'] == 10.0


def test_read_range_ranks_colours_across_the_whole_window(client, store):
    seed_day(client, _today(), {
        '20': {'n': 5, 'buckets': {
            '0': {'n': 2, 'r': 510, 'g': 0, 'b': 0},
            '8': {'n': 3, 'r': 0, 'g': 0, 'b': 765},
        }},
    })

    colors = store.read_range(1)['totals']['colors']

    assert [row['label'] for row in colors] == ['blue', 'red']
    assert colors[0]['count'] == 3
    assert colors[0]['share'] == 0.6
    assert colors[0]['hex'] == '#0000ff'


def test_read_range_is_not_confused_by_get_all_ordering(client, store):
    """get_all promises no ordering; the grid must still come out by date."""
    today = _today()
    yesterday = (date.fromisoformat(today) - timedelta(days=1)).isoformat()
    seed_day(client, today, {'1': {'n': 1, 'buckets': {'0': {'n': 1, 'r': 255, 'g': 0, 'b': 0}}}})
    seed_day(client, yesterday, {'2': {'n': 7, 'buckets': {'8': {'n': 7, 'r': 0, 'g': 0, 'b': 1785}}}})

    grid = store.read_range(2)['grid']

    assert [day['date'] for day in grid] == [yesterday, today]
    assert [day['count'] for day in grid] == [7, 1]


def test_read_range_caches_between_calls(client):
    store = StatsStore(client, cache_ttl=300)
    seed_day(client, _today(), {'20': {'n': 1, 'buckets': {'0': {'n': 1, 'r': 255, 'g': 0, 'b': 0}}}})

    first = store.read_range(1)
    client.collection(STATS_DAILY_COLLECTION).docs.clear()

    assert store.read_range(1) is first


def test_a_rollup_invalidates_the_read_cache(client):
    """A cached empty month must not survive the rollup that fills it."""
    store = StatsStore(client, cache_ttl=300)
    today = date.fromisoformat(_today())
    assert store.read_range(1)['totals']['count'] == 0

    noon = datetime(today.year, today.month, today.day, 12, tzinfo=STATS_TZ)
    client.seed(REQUESTS_COLLECTION, 'a', request_doc(noon, 255, 0, 0))
    store.rollup(today, today)

    assert store.read_range(1)['totals']['count'] == 1


def _today():
    return datetime.now(timezone.utc).astimezone(STATS_TZ).date().isoformat()
