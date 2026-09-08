import type { ColorRow, StatsDay } from "../stats-api";
import { formatCount, formatDayLong, pluralise } from "../format";

/**
 * The mosaic's table twin.
 *
 * The mosaic shows popularity as area, which is a glance rather than a
 * number, and it drops the calendar entirely. Both come back here.
 */
export const StatsTable = ({ grid, colors }: { grid: StatsDay[]; colors: ColorRow[] }) => {
  const active = grid.filter((day) => day.count > 0);

  if (!active.length) {
    return (
      <p className="stats-note px-6 pb-6">
        No colours were displayed in this window.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto px-6 pb-6">
      <table className="w-full min-w-[34rem] border-collapse text-left">
        <caption className="sr-only">
          Colours displayed per family, for every day with activity
        </caption>
        <thead>
          <tr className="stats-card-head">
            <th scope="col" className="stats-th">Night</th>
            <th scope="col" className="stats-th">Total</th>
            <th scope="col" className="stats-th">By colour</th>
          </tr>
        </thead>
        <tbody>
          {active.map((day) => (
            <tr key={day.date} className="stats-row">
              <th scope="row" className="stats-td stats-td--night stats-ink font-bold">
                {formatDayLong(day.date)}
              </th>
              <td className="stats-td stats-muted tabular-nums">{formatCount(day.count)}</td>
              <td className="stats-td stats-muted">
                <ul className="flex flex-wrap gap-x-4 gap-y-1">
                  {/* Ordered by the range ranking, so every row reads the
                      same way and the busiest colour is always first. */}
                  {colors
                    .filter((color) => (day.colors[color.key] ?? 0) > 0)
                    .map((color) => (
                      <li key={color.key} className="flex items-center gap-1.5">
                        <span
                          aria-hidden="true"
                          className="stats-swatch h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: color.hex ?? "transparent" }}
                        />
                        <span className="tabular-nums">
                          {color.label}: {pluralise(day.colors[color.key], "colour")}
                        </span>
                      </li>
                    ))}
                </ul>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
