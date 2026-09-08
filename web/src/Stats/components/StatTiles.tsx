import type { StatsTotals } from "../stats-api";
import { formatCount, formatDayLong, formatHour } from "../format";

type TileProps = { label: string; value: string; detail: string };

const Tile = ({ label, value, detail }: TileProps) => (
  <article className="stats-tile">
    <p className="stats-eyebrow">{label}</p>
    {/* Proportional figures: tabular-nums makes a big standalone number
        look loose. The table view is where digits need to line up. */}
    <p className="stats-ink mt-4 text-3xl font-bold tracking-tight">{value}</p>
    <p className="stats-muted mt-2 text-[0.8rem]">{detail}</p>
  </article>
);

export const StatTiles = ({ totals, days }: { totals: StatsTotals; days: number }) => (
  <>
    {/* The hero figure: exactly one per view, and it is the number the page
        exists to report. */}
    <article className="stats-hero p-6 sm:p-8">
      <div className="stats-hero-glow" />
      <div className="relative">
        <p className="stats-eyebrow stats-eyebrow--accent">Colours on the strip</p>
        <p className="stats-ink mt-3 text-5xl font-bold leading-none tracking-tight sm:text-6xl">
          {formatCount(totals.count)}
        </p>
        <p className="stats-muted mt-3 text-[0.85rem]">
          {totals.count === 0
            ? `Nothing has lit up in the last ${days} days`
            : `Sent by the community over the last ${days} days`}
        </p>
      </div>
    </article>

    <Tile
      label="Nights running"
      value={formatCount(totals.active_days)}
      detail={
        totals.active_days
          ? `${totals.avg_per_active_day} colours on an average night`
          : "No activity in this window yet"
      }
    />
    <Tile
      label="Busiest night"
      value={totals.busiest_day ? formatCount(totals.busiest_day.count) : "—"}
      detail={totals.busiest_day ? formatDayLong(totals.busiest_day.date) : "Nothing yet"}
    />
    <Tile
      label="Peak hour"
      value={totals.busiest_hour ? formatHour(totals.busiest_hour.hour) : "—"}
      detail={
        totals.busiest_hour
          ? `${formatCount(totals.busiest_hour.count)} colours across the window`
          : "Nothing yet"
      }
    />
  </>
);
