# Colour stats and the colour × day grid

A public page at `/stats` showing what the LED strip has actually been doing:
a grid with one row per colour family and one square per day, plus an
hour-of-day profile and the headline numbers around them.

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

Each bin becomes a **row** of the grid, and the mean colour of the bin is the
row's shade. Every bin a day saw is reported with its own count -- the grid is
not a "winner takes the square" summary.

### Firestore setup

Two things to configure, neither in code:

1. **Composite index** on `requests`: `status ASC, processed_at ASC` — the
   rollup's range query needs it. (Separate from the existing
   `status, scheduled_time` index.)
2. **Single-field index exemption** on `stats_daily.hours`. That map holds
   roughly 1,150 numeric leaves, all auto-indexed by default, which is index
   write cost for fields nothing ever queries.

```
gcloud firestore indexes composite create \
  --collection-group=requests \
  --field-config=field-path=status,order=ascending \
  --field-config=field-path=processed_at,order=ascending

gcloud firestore indexes fields update \
  --collection-group=stats_daily --field-path=hours \
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
like the colour form. `days` is clamped to 1–90; anything else is a 400.

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
    "peak_color_day": 127,
    "hours": [{ "h": 0, "n": 0 }, "... all 24, for the hour profile"],
    "colors": [
      { "key": "1", "label": "orange", "hex": "#ef8213", "count": 303, "share": 0.2606 }
    ]
  },
  "grid": [
    { "date": "2026-09-06", "count": 191, "colors": { "1": 127, "9": 29, "dark": 21 } }
  ]
}
```

`totals.colors` is the grid's row order. `peak_color_day` is the busiest single
*(colour, day)* cell, which sets the top of the grid's intensity scale -- not
`busiest_day`, which sums every colour and would leave every cell pale.

## The page

Not linked from anywhere yet -- the plan is to collect a month of data first,
then publish it by adding a link to `web/src/layout/Footer.tsx`. Until then it
is reachable at `/stats` and nowhere else.

## The chart, and the one it replaced

The first version of this page was a **day x hour** grid: each cell painted
with that hour's most-picked colour, dimmed by how many colours came in.

That encoding cannot work, and it is worth writing down why. Brightness carried
the count -- but brightness is also an intrinsic property of a colour the
audience chose, and nobody controls that. The two meanings collided and the
scale ran backwards: a cell of three near-black submissions rendered *darker*
than a cell of two white ones. Measured on real data, the busiest near-black
cell came out less than a third as bright as the quietest pale one.

No fix keeps that layout, because luminance cannot carry volume while the data
is itself luminance. The volume encoding had to move.

**Colour x day** is where it moved to. One row per colour family, one column
per day:

- A row is a **single fixed hue**, so light-to-dark inside it means only "more
  of this colour". That is the one arrangement where a sequential ramp is
  honest -- it is the "sequential = one hue" rule, applied per row.
- **Nothing asks the reader to compare two hues by brightness.** The ranking is
  the row order, stated again as a count and a share in text at the end of each
  row.
- **Every colour is shown, not each hour's winner.** An hour with fifty
  submissions across six families used to render as a single square; now all
  six appear in their own rows.
- **Volume over time moved out** into a separate hour-of-day bar chart, drawn
  in one accent colour because it is pure magnitude and must not borrow the
  audience's hues.

Two details the grid needs in order to stay truthful:

- **A square-root intensity ramp.** Nightly counts are heavily skewed -- one
  big night can be ten times a normal one. Under linear normalisation that
  single cell takes the top step and everything else collapses into the bottom
  one, so the grid degenerates into present/absent. A square root spreads the
  middle out while staying monotonic.
- **A lightness floor, on the ramp only.** The "near black" family averages to
  something like `#111016`, indistinguishable from the card behind it; its row
  would render as empty whatever the counts. The ramp scales all three channels
  up to a minimum lightness, which leaves the ratios -- and so the hue -- alone.
  The row-header swatch and the tooltip still show the true measured colour, so
  nothing is misstated; the dark row is drawn in a legible proxy of itself.

The rest carries over unchanged: every cell has an `aria-label`, a hover *and*
focus tooltip, arrow keys rove a single tab stop through the grid, and the card
below holds a table with every value.

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
