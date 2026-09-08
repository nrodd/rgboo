import { useState } from "react";
import { Link } from "react-router-dom";
import "./stats.css";
import LogoIcon from "../assets/pumpkin.svg?react";
import { RANGE_PRESETS } from "./stats-api";
import { useStats } from "./useStats";
import { formatUpdatedAt } from "./format";
import { StatTiles } from "./components/StatTiles";
import { ColorHeatmap } from "./components/ColorHeatmap";
import { TopColors } from "./components/TopColors";
import { StatsTable } from "./components/StatsTable";

const Stats = () => {
  const { stats, error, isLoading, isRefreshing, days, setDays } = useStats(30);
  const [showTable, setShowTable] = useState(false);

  return (
    <main className="admin-shell min-h-dvh px-5 py-6 text-bone sm:px-8 sm:py-10">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <Link to="/" className="flex items-center gap-3 text-bone hover:opacity-80">
            <LogoIcon viewBox="0 0 441 409" className="h-10 w-10" />
            <span className="stats-heading">
              RGBoo stats
            </span>
          </Link>
          <p className="stats-faint text-[0.7rem] font-medium">
            Updated {formatUpdatedAt(stats?.updated_at ?? null)}
          </p>
        </header>

        {/* One filter row, above everything it scopes. */}
        <div className="flex flex-wrap items-center gap-2">
          {RANGE_PRESETS.map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => setDays(preset)}
              aria-pressed={days === preset}
              className={days === preset ? "stats-range-button stats-range-button--on" : "stats-range-button"}
            >
              Last {preset} days
            </button>
          ))}
        </div>

        {error && (
          <p role="alert" className="stats-alert">
            {error}
          </p>
        )}

        {isLoading && !error && (
          <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4" aria-label="Loading stats">
            {[0, 1, 2, 3].map((item) => (
              <div key={item} className="stats-skeleton animate-pulse" />
            ))}
          </section>
        )}

        {stats && (
          <>
            <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4" aria-label="Summary">
              <StatTiles totals={stats.totals} days={stats.days} />
            </section>

            <ColorHeatmap
              grid={stats.grid}
              peak={stats.totals.peak_hour_count}
              timezone={stats.timezone}
              isRefreshing={isRefreshing}
            />

            <section className="stats-card">
              <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-5">
                <div>
                  <p className="stats-eyebrow">Every number</p>
                  <h2 className="stats-heading mt-1">
                    The data behind the grid
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setShowTable((open) => !open)}
                  aria-expanded={showTable}
                  className="admin-quiet-button"
                >
                  {showTable ? "Hide table" : "Show table"}
                </button>
              </div>
              {showTable && <StatsTable grid={stats.grid} />}
            </section>

            <TopColors colors={stats.totals.top_colors} />

            <p className="stats-faint pb-4 text-[0.7rem] leading-relaxed">
              Counts only colours that actually reached the LEDs — cancelled and
              still-queued requests are not included. Times are{" "}
              {stats.timezone.replace("_", " ")}.
            </p>
          </>
        )}
      </div>
    </main>
  );
};

export default Stats;
