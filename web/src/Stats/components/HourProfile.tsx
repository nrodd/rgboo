import type { HourSlot } from "../stats-api";
import { formatCount, formatHour, pluralise } from "../format";

/**
 * When the stream is busy: submissions by hour of day, across the window.
 *
 * Pure magnitude, so it is drawn in one accent colour rather than in the
 * audience's hues. That separation is the point -- "when" and "which
 * colour" used to fight over the same channel in one grid.
 */

/** Trim the dead hours, padded by one either side. */
const activeWindow = (hours: HourSlot[]) => {
  const used = hours.filter((slot) => slot.n > 0);
  if (!used.length) return hours;
  const from = Math.max(0, Math.min(...used.map((slot) => slot.h)) - 1);
  const to = Math.min(23, Math.max(...used.map((slot) => slot.h)) + 1);
  return hours.filter((slot) => slot.h >= from && slot.h <= to);
};

export const HourProfile = ({ hours }: { hours: HourSlot[] }) => {
  const shown = activeWindow(hours);
  const peak = Math.max(...shown.map((slot) => slot.n), 0);

  return (
    <section className="stats-card" aria-labelledby="hours-heading">
      <div className="px-6 py-5">
        <p className="stats-eyebrow">When people show up</p>
        <h2 id="hours-heading" className="stats-heading mt-1">
          Busiest hours
        </h2>
      </div>

      {peak === 0 ? (
        <p className="stats-note px-6 pb-6">No colours in this window yet.</p>
      ) : (
        <div className="overflow-x-auto px-6 pb-6">
          <div className="stats-hour-chart">
            <ul className="stats-hours">
              {shown.map((slot) => (
                <li key={slot.h} className="stats-hour-col">
                  <span
                    className="stats-hour-bar"
                    style={{ height: `${(slot.n / peak) * 100}%` }}
                    title={`${formatHour(slot.h)}: ${pluralise(slot.n, "colour")}`}
                  >
                    {/* Only the peak is direct-labelled, and it sits out of
                        flow so it cannot alter the bar it labels. A number on
                        every bar is chaos and goes unread; the rest are in
                        the tooltip and the table. */}
                    {slot.n === peak && (
                      <span className="stats-hour-value">{formatCount(slot.n)}</span>
                    )}
                  </span>
                  <span className="sr-only">
                    {formatHour(slot.h)}: {pluralise(slot.n, "colour")}
                  </span>
                </li>
              ))}
            </ul>
            {/* Every hour is labelled, not every third: a label on some bars
                and not others reads as arbitrary rather than as an axis. */}
            <ul className="stats-hour-axis" aria-hidden="true">
              {shown.map((slot) => (
                <li key={slot.h} className="stats-hour-label">
                  {formatHour(slot.h)}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </section>
  );
};
