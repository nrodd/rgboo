import type { StatsDay } from "../stats-api";
import { formatCount, formatDayLong, formatHour, pluralise } from "../format";

/**
 * The heatmap's table twin.
 *
 * The grid encodes two things in one square (which colour, how many), which
 * is only fair to a reader who can also get the numbers without hovering.
 * Every value in the heatmap is reachable here.
 */
export const StatsTable = ({ grid }: { grid: StatsDay[] }) => {
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
          Colours displayed per hour, for every day with activity
        </caption>
        <thead>
          <tr className="stats-card-head">
            <th scope="col" className="stats-th">Night</th>
            <th scope="col" className="stats-th">Total</th>
            <th scope="col" className="stats-th">By hour</th>
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
                  {day.hours.map((cell) => (
                    <li key={cell.h} className="flex items-center gap-1.5">
                      {cell.hex && (
                        <span
                          aria-hidden="true"
                          className="stats-swatch h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: cell.hex }}
                        />
                      )}
                      <span className="tabular-nums">
                        {formatHour(cell.h)}: {pluralise(cell.n, "colour")}
                        {cell.label ? ` (${cell.label})` : ""}
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
