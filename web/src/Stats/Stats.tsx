import { useState } from "react";
import { Link } from "react-router-dom";
import "./stats.css";
import LogoIcon from "../assets/pumpkin.svg?react";
import { useStats } from "./useStats";
import { formatUpdatedAt } from "./format";
import { StatTiles } from "./components/StatTiles";
import { ColorMosaic } from "./components/ColorMosaic";
import { HourProfile } from "./components/HourProfile";
import { StatsTable } from "./components/StatsTable";
import { ComingSoon } from "./components/ComingSoon";

const Stats = () => {
  const { stats, isLoading } = useStats();
  const [showTable, setShowTable] = useState(false);

  // Nothing dispatched yet, the rollup never run, or the aggregates
  // unreachable: all three leave nothing to draw and a visitor cannot act on
  // the difference. Everything below this gate may assume a non-empty window.
  const hasData = !!stats && stats.totals.count > 0;
  const showComingSoon = !isLoading && !hasData;

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
          {hasData && (
            <p className="stats-faint text-[0.7rem] font-medium">
              Updated {formatUpdatedAt(stats.updated_at)}
            </p>
          )}
        </header>

        {isLoading && (
          <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4" aria-label="Loading stats">
            {[0, 1, 2, 3].map((item) => (
              <div key={item} className="stats-skeleton animate-pulse" />
            ))}
          </section>
        )}

        {showComingSoon && <ComingSoon />}

        {hasData && (
          <>
            <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4" aria-label="Summary">
              <StatTiles totals={stats.totals} days={stats.days} />
            </section>

            <ColorMosaic
              sequence={stats.totals.sequence}
              colors={stats.totals.colors}
              total={stats.totals.count}
              sampled={stats.totals.sampled}
            />

            <HourProfile hours={stats.totals.hours} />

            <section className="stats-card">
              <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-5">
                <div>
                  <p className="stats-eyebrow">Every number</p>
                  <h2 className="stats-heading mt-1">
                    The data behind the picture
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
              {showTable && <StatsTable grid={stats.grid} colors={stats.totals.colors} />}
            </section>

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
