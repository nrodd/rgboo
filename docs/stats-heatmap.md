# Colour stats and the colour mosaic

A public page at `/stats` showing what the LED strip has actually been doing:
a mosaic of every colour anyone picked, one square per submission, in the order
they arrived — plus an hour-of-day profile and the headline numbers around them.

Related: [architecture.md](architecture.md) (the system this reads from),
[deploying.md](deploying.md) (shipping it).

## What it counts

Only requests that reached `status: done` — colours that actually lit up the
strip. Cancelled requests, requests still in the queue, and anything an admin
cleared are all excluded. The page says so in its own footer, because "1,284
colours" means nothing if a reader can't tell whether it counts things nobody
ever saw.

Usernames are never copied into the aggregates. A redacted request still counts
toward the totals, but nothing identifying survives the rollup — which also
means [an admin clear](admin-clear-current.md) can't leave a name stranded in
the stats.

## Why the aggregates are computed offline

The obvious design is a counter the bridge bumps on every dispatch. This does
something different, and the reason is worth stating.

`requests` is an append-only log: nothing in the system ever deletes a request
document, and `done` is terminal. So the daily aggregates are **pure derived
data** — recomputable from the log at any time. That makes a scheduled job
unnecessary. Running `scripts/rollup_stats.py` once, before publishing the
page, produces exactly the same numbers as an hourly job would have produced
over the same month.

| | Increment at dispatch | Offline rollup (what this does) |
|---|---|---|
| Bridge change | Required | None |
| Redaction / late cancellation | Counters drift permanently | Self-heals on the next run |
| Backfilling history | A separate script | The same command, wider range |
| Scheduled infrastructure | — | None |
| Freshness | Instant | As of the last run |

The cost is staleness, and the page is honest about it: it reports
`Updated <timestamp>` from the newest aggregate. Live "what's on right now"
already exists at `GET /api/status`; this page is a retrospective.

Reading the raw log per page view was never an option — a busy month is tens of
thousands of documents against a 50k/day free-tier read budget. A month of
aggregates is at most 31 documents, fetched in one `get_all`.

## Why the timezone matters

`processed_at` is a UTC timestamp, and a day × hour grid bucketed in UTC is
wrong twice over:

- **Hours land in the wrong row.** A stream running 8–11pm ET is 00:00–03:00
  UTC, so the busy band would render in the small hours.
- **One evening splits across two columns.** 8pm–midnight ET is one UTC day;
  midnight–2am ET is the next. A single session shows up as two weak
  half-sessions in adjacent columns instead of one bright block.

Neither is fixable in the browser: bucketing happens at rollup, so by the time
an aggregate exists the night is already cut in half. Hence `STATS_TIMEZONE` in
`shared/schema.py`, applied to every day and hour key.

A fixed UTC offset would avoid the `tzdata` dependency but break across DST —
and DST ends on 1 November, in the middle of Halloween season. Changing the
constant invalidates every existing aggregate, so a change means re-running the
rollup over the full range.

## Data model

**`stats_daily/{YYYY-MM-DD}`** — one document per local day. Absent for days
with nothing dispatched.

| Field | Notes |
|---|---|
| `date` | Same as the document id |
| `count` | Dispatched requests that day |
| `hours` | `"0".."23"` → `{ n, buckets }`, populated hours only |
| `hours.<h>.buckets` | Hue bin → `{ n, r, g, b }`, the channels as **sums** |
| `sequence` | Every colour that day, rounded, in dispatch order. The mosaic |
| `timezone`, `updated_at` | What the rollup used, and when it ran |

Sums rather than an average, because sums are what a recount can rebuild and
what a range query can merge. The average is taken at read time and only
*within* one hue bin — averaging across bins turns a night of red and blue into
mud.

**Hue bins** (`cloud_api/buckets.py`): twelve 30° bins, each *centred* on its
name's canonical hue, so pure red sits in the middle of "red" rather than on
the boundary with "rose". Two extra bins catch colours that have no meaningful
hue — `dark` (lightness < 0.10) and `neutral` (saturation < 0.15) — which would
otherwise smear randomly across all twelve, since hue is numerically unstable
down there.

The bins are now only used for the summary bar under the mosaic. The mosaic
itself is unbinned: `sequence` on each day document lists every colour that day
in dispatch order, rounded to `SWATCH_STEP` per channel. Two colours a step
apart are indistinguishable on an LED strip, and the rounding keeps the stored
list compact.

A list rather than a frequency map, because arrival order is exactly what a
count throws away, and order is what the mosaic draws.

Neutrality is decided by **chroma** (max channel minus min), not HLS
saturation. Saturation divides by a term that vanishes at the extremes, so it
reports `1.0` for `#fff8f8` — a near-white — which used to file it as a vivid
red. Chroma reports `0.03` for the same colour, which is what the eye says.

### Firestore setup

Two things to configure, neither in code:

1. **Composite index** on `requests`: `status ASC, processed_at ASC` — the
   rollup's range query needs it. (Separate from the existing
   `status, scheduled_time` index.)
2. **Single-field index exemptions** on `stats_daily.hours` and
   `stats_daily.sequence`. Between them those maps hold a few thousand numeric
   leaves, all auto-indexed by default, which is index write cost for fields
   nothing ever queries.

```
gcloud firestore indexes composite create \
  --collection-group=requests \
  --field-config=field-path=status,order=ascending \
  --field-config=field-path=processed_at,order=ascending

gcloud firestore indexes fields update \
  --collection-group=stats_daily --field-path=hours \
  --disable-indexes

gcloud firestore indexes fields update \
  --collection-group=stats_daily --field-path=sequence \
  --disable-indexes
```

## Rebuilding the aggregates

```bash
python scripts/rollup_stats.py                  # last 30 local days
python scripts/rollup_stats.py --days 90        # a wider window
python scripts/rollup_stats.py --from 2026-10-01 --to 2026-10-31
python scripts/rollup_stats.py --dry-run        # count, write nothing
```

Idempotent: each day is a full recount written with `set()`, never an
increment, so re-running over the same or an overlapping range converges. That
is also what makes it the repair tool if an aggregate ever looks wrong.

Against the emulator, set `FIRESTORE_EMULATOR_HOST` first (`scripts/dev.sh`
does). Against production it needs application-default credentials and
`GOOGLE_CLOUD_PROJECT`.

## API

`GET /api/stats?days=30` — public, reached through the Worker's `/api/*` proxy
like the colour form. `days` is clamped to 1–90; anything else is a 400. The
page only ever asks for 30 — there is no range switcher — but the parameter
stays because `scripts/rollup_stats.py` and any manual poking want it.

Reads at most 31 documents and never touches the request log, so its cost does
not grow with how busy the stream was. Cached three ways: a 5-minute in-process
memo in `StatsStore`, `Cache-Control: public, max-age=300` on the response, and
a `cf.cacheTtl` hint in the Worker — `/api/stats` is the only route there that
is cacheable at all, since everything else is live queue state.

Empty hours are omitted rather than sent as zeroes, which keeps a month around
25 KB.

```json
{
  "timezone": "America/New_York",
  "days": 30,
  "start_date": "2026-08-10", "end_date": "2026-09-08",
  "updated_at": "2026-09-08T04:54:00+00:00",
  "totals": {
    "count": 1163, "active_days": 21, "avg_per_active_day": 55.4,
    "busiest_day": { "date": "2026-09-06", "count": 191 },
    "busiest_hour": { "hour": 21, "count": 280 },
    "hours": [{ "h": 0, "n": 0 }, "... all 24, for the hour profile"],
    "colors": [
      { "key": "1", "label": "orange", "hex": "#ef8213", "count": 293, "share": 0.2519 }
    ],
    "sequence": ["#f06000", "#c82828", "... every colour, in arrival order"],
    "sampled": false
  },
  "grid": [
    { "date": "2026-09-06", "count": 191, "colors": { "1": 127, "9": 29, "dark": 21 } }
  ]
}
```

`totals.sequence` is the mosaic, in dispatch order. `totals.colors` is the
summary bar beneath it, and `totals.hours` is the hour-of-day chart, always all
24 entries. A month of 1,163 picks is a 17 KB payload.

A 24/7 stream at the 20-second pace tops out near 130,000 requests a month,
which is neither renderable nor a sensible response. Past `MAX_SEQUENCE` the
list is thinned by taking every Nth — keeping the month's shape end to end
rather than just its tail — and `sampled` tells the page to say so.

## The page

Not linked from anywhere yet -- the plan is to collect a month of data first,
then publish it by adding a link to `web/src/layout/Footer.tsx`. Until then it
is reachable at `/stats` and nowhere else.

## The chart, and the two it replaced

The first version was a **day × hour** grid, each cell painted with that hour's
most-picked colour and dimmed by volume. The second was a **colour × day**
grid, one row per family, each row a single hue deepening with its count.

Both encoded a count as brightness, and that cannot work here. Brightness is
*also* an intrinsic property of a colour the audience chose, so the two
meanings collide. On the first version the scale ran backwards outright:
measured on real data, a cell of three near-black submissions rendered less
than a third as bright as a cell of two pale ones. The second version fixed
that by making each row one fixed hue, but it still paid a row per family —
which forced the binning down to fourteen coarse names and hid every shade.

The mosaic encodes **nothing**, and reorders nothing. One square per
submission, left to right in the order they arrived: it is the month as it
happened. Because it costs no rows it needs no binning at all, so every shade
shows as itself — a seeded month of 1,163 picks is 740 distinct colours rather
than fourteen names.

- **No hover layer.** The squares are the record. Every number a reader might
  want is in the summary bar below or the table further down, so nothing has to
  be hovered to be reached.
- **A summary bar keeps the exact numbers.** The mosaic deliberately says
  nothing about which colour won — arrival order scatters a popular colour
  across the whole picture. A single stacked bar of the fourteen families sits
  underneath with counts and shares. That is the one place the coarse bins
  still earn their keep.
- **A hairline ring on every square**, so a near-black pick reads as a square
  rather than as a gap in the mosaic.

The hour chart shows **all 24 hours**, never trimmed to the ones that happened
to be busy: the strip runs around the clock, so a quiet hour is a finding rather
than an absence. Every bar is labelled — a label on some bars and not others
reads as arbitrary rather than as an axis — with compact ticks (`12a`, then bare
numbers, then `12p`) because spelled-out names are wider than their columns and
the last one gets clipped. Only the peak carries a value, positioned out of
flow: as a flex item it overflowed its column and was the one bar the browser
shrank, which made the peak render shorter than the runner-up.

The mosaic drops the calendar entirely. `grid` still carries per-day, per-family
counts, and the table view under the chart is where both the numbers and the
nights come back.

Styles live in `web/src/Stats/stats.css`, imported by `Stats.tsx` so the page's
chrome travels with its components rather than accumulating in the global
`theme.css`. They are raw CSS rather than `@apply`, for two reasons this theme
forces: `--color-*: initial` deletes Tailwind's default palette, so
`white`/`black`/`red` utilities generate no CSS at all; and `--text-sm`/`base`/
`md` are deliberately oversized for the colour form, which makes those
utilities unusable for dense UI. The rules stay in the `components` layer that
`theme.css` declares, so Tailwind utilities in JSX still win over them.

## Failure modes

| If this happens | Then |
|---|---|
| The rollup has never run | `/api/stats` returns an all-zero window and the page says so. No error. |
| A malformed request doc | Logged and skipped; the rest of the rollup completes. |
| A day has no dispatched colours | No document is written. `count` can only grow, so an empty result always means "nothing ever happened", never "the data went away". |
| `STATS_TIMEZONE` changes | Existing aggregates are wrong until the rollup is re-run over the full range. |
| The API has no stats store | `/api/stats` answers 503; the rest of the API is unaffected. |
