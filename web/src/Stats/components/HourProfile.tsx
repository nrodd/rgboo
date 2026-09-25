import type { HourSlot } from "../stats-api";
import { formatCount, formatHour, formatHourTick, pluralise } from "../format";

/**
 * Submissions by hour of day. Pure magnitude, so it uses one accent colour
 * rather than the audience's hues.
 */

export const HourProfile = ({ hours }: { hours: HourSlot[] }) => {
  // All 24, never trimmed to the busy ones: a quiet hour is a finding.
  const shown = hours;
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
                    {/* Only the peak is labelled, out of flow so it cannot
                        alter the bar it labels. */}
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
            {/* Every hour, not every third: partial labels read as
                arbitrary rather than as an axis. Compact so all 24 fit. */}
            <ul className="stats-hour-axis" aria-hidden="true">
              {shown.map((slot) => (
                <li key={slot.h} className="stats-hour-label">
                  {formatHourTick(slot.h)}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </section>
  );
};
