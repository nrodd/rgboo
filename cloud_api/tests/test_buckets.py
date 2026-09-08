"""Unit tests for the pure bucketing math behind the colour stats."""

from datetime import date, datetime, timezone

import pytest

from ..buckets import (
    STATS_TZ,
    accumulate,
    bucket_hex,
    bucket_label,
    day_key,
    day_range,
    hour_key,
    hue_bucket,
    local_midnight,
    merge_buckets,
    rank_buckets,
)


def utc(year, month, day, hour=0, minute=0):
    return datetime(year, month, day, hour, minute, tzinfo=timezone.utc)


# ---------------------------------------------------------------------------
# Hue binning
# ---------------------------------------------------------------------------

@pytest.mark.parametrize("rgb,expected", [
    ((255, 0, 0), "0"),      # pure red, the centre of bin 0
    ((255, 128, 0), "1"),    # orange
    ((255, 255, 0), "2"),    # yellow
    ((0, 255, 0), "4"),      # green
    ((0, 255, 255), "6"),    # cyan
    ((0, 0, 255), "8"),      # blue
    ((255, 0, 255), "10"),   # magenta
])
def test_primary_colors_land_in_their_named_bin(rgb, expected):
    assert hue_bucket(*rgb) == expected


def test_bins_are_centred_so_red_does_not_straddle_a_boundary():
    """Hues either side of 0 degrees must both read as red, not split."""
    assert hue_bucket(255, 10, 0) == "0"     # ~2 degrees
    assert hue_bucket(255, 0, 10) == "0"     # ~358 degrees


def test_near_black_gets_its_own_bin():
    # Hue is numerically meaningless down here; without this it would smear
    # randomly across all twelve bins.
    assert hue_bucket(0, 0, 0) == "dark"
    assert hue_bucket(12, 3, 5) == "dark"


def test_white_and_grey_share_the_neutral_bin():
    assert hue_bucket(255, 255, 255) == "neutral"
    assert hue_bucket(128, 128, 128) == "neutral"
    assert hue_bucket(200, 198, 202) == "neutral"


def test_a_barely_tinted_near_white_is_neutral_not_a_vivid_hue():
    """HLS saturation reports 1.0 here; chroma reports 0.03."""
    assert hue_bucket(255, 248, 248) == "neutral"
    assert hue_bucket(248, 255, 250) == "neutral"


def test_a_genuinely_dusty_pastel_keeps_its_hue():
    # The threshold must not swallow real, if muted, colours.
    assert hue_bucket(224, 176, 176) == "0"


def test_a_dark_but_saturated_colour_is_dark_not_neutral():
    assert hue_bucket(20, 0, 0) == "dark"


def test_labels_cover_every_bin():
    assert bucket_label("0") == "red"
    assert bucket_label("8") == "blue"
    assert bucket_label("dark") == "near black"
    assert bucket_label("neutral") == "white / grey"
    assert bucket_label("nonsense") == "unknown"


# ---------------------------------------------------------------------------
# Day and hour keys
# ---------------------------------------------------------------------------

def test_days_are_bucketed_in_stream_local_time_not_utc():
    """01:30 UTC is still the previous evening on the stream."""
    moment = utc(2026, 9, 8, 1, 30)
    assert day_key(moment) == "2026-09-07"
    assert hour_key(moment) == "21"


def test_a_naive_timestamp_is_read_as_utc():
    # Never as the host's local time, or the same data would bucket
    # differently on a laptop than on Cloud Run.
    naive = datetime(2026, 9, 8, 1, 30)
    assert day_key(naive) == "2026-09-07"


def test_day_range_is_inclusive_and_oldest_first():
    days = day_range(date(2026, 9, 8), 3)
    assert days == [date(2026, 9, 6), date(2026, 9, 7), date(2026, 9, 8)]


def test_local_midnight_is_an_offset_aware_local_time():
    midnight = local_midnight(date(2026, 9, 8))
    assert midnight.tzinfo is STATS_TZ
    assert (midnight.hour, midnight.minute) == (0, 0)
    # September is EDT, so local midnight is 04:00 UTC.
    assert midnight.astimezone(timezone.utc).hour == 4


def test_day_boundaries_shift_across_the_dst_change():
    """EST puts local midnight at 05:00 UTC instead of 04:00."""
    assert local_midnight(date(2026, 12, 1)).astimezone(timezone.utc).hour == 5


# ---------------------------------------------------------------------------
# Aggregation
# ---------------------------------------------------------------------------

def test_bucket_hex_averages_within_a_bin():
    assert bucket_hex({"n": 2, "r": 510, "g": 0, "b": 0}) == "#ff0000"
    assert bucket_hex({"n": 2, "r": 255, "g": 255, "b": 255}) == "#808080"


def test_bucket_hex_is_none_for_an_empty_bin():
    assert bucket_hex({"n": 0, "r": 0, "g": 0, "b": 0}) is None


def test_merge_buckets_sums_counts_and_channels():
    target = {"0": {"n": 1, "r": 255, "g": 0, "b": 0}}
    merge_buckets(target, {"0": {"n": 2, "r": 400, "g": 10, "b": 10}, "8": {"n": 1, "r": 0, "g": 0, "b": 255}})
    assert target["0"] == {"n": 3, "r": 655, "g": 10, "b": 10}
    assert target["8"]["n"] == 1


def test_rank_buckets_orders_by_count_with_shares():
    ranked = rank_buckets({
        "0": {"n": 3, "r": 765, "g": 0, "b": 0},
        "8": {"n": 9, "r": 0, "g": 0, "b": 2295},
    })
    assert [entry["label"] for entry in ranked] == ["blue", "red"]
    assert ranked[0]["share"] == 0.75
    assert ranked[0]["hex"] == "#0000ff"


def test_rank_buckets_returns_every_populated_bin_and_handles_empty():
    many = {str(index): {"n": index + 1, "r": 0, "g": 0, "b": 0} for index in range(10)}
    assert len(rank_buckets(many)) == 10
    assert rank_buckets({}) == []


def test_accumulate_groups_by_local_day_and_hour():
    days = accumulate([
        (utc(2026, 9, 7, 23, 0), 255, 0, 0),    # 19:00 local, 9/7
        (utc(2026, 9, 7, 23, 30), 250, 5, 5),   # same hour, same bin
        (utc(2026, 9, 8, 1, 0), 0, 0, 255),     # 21:00 local, still 9/7
        (utc(2026, 9, 8, 16, 0), 0, 255, 0),    # 12:00 local, 9/8
    ])

    assert set(days) == {"2026-09-07", "2026-09-08"}
    assert days["2026-09-07"]["count"] == 3
    assert days["2026-09-07"]["hours"]["19"]["n"] == 2
    assert days["2026-09-07"]["hours"]["19"]["buckets"]["0"]["n"] == 2
    assert days["2026-09-07"]["hours"]["21"]["buckets"]["8"]["n"] == 1
    assert days["2026-09-08"]["count"] == 1


def test_accumulate_of_nothing_is_empty():
    assert accumulate([]) == {}
