import type { HourSlot } from "../stats-api";
import { formatCount, formatHour, formatHourTick, pluralise } from "../format";

/**
 * Submissions by hour of day, across the window.
 *
 * All twenty-four, never trimmed to the hours that happened to be busy: the
 * strip runs around the clock, so a quiet hour is a finding rather than an
 * absence, and hiding it would overstate how narrow the day is.
 */
export const HourProfile = ({ hours }: { hours: HourSlot[] }) => {
  const peak = Math.max(...hours.map((slot) => slot.n));

  return (
    <section className="stats-card" aria-labelledby="hours-heading">
      <div className="px-6 py-5">
        <p className="stats-eyebrow">When people show up</p>
        <h2 id="hours-heading" className="stats-heading mt-1">
          Busiest hours
        </h2>
      </div>

      <div className="overflow-x-auto px-6 pb-6">
        <div className="stats-hour-chart">
          <ul className="stats-hours">
            {hours.map((slot) => (
              <li key={slot.h} className="stats-hour-col">
                <span
                  className="stats-hour-bar"
                  style={{ height: `${(slot.n / peak) * 100}%` }}
                  title={`${formatHour(slot.h)}: ${pluralise(slot.n, "colour")}`}
                >
                  {/* Only the peak is direct-labelled, and it sits out of
                      flow so it cannot alter the bar it labels. */}
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
          {/* Every hour is labelled, not every third: a label on some bars and
              not others reads as arbitrary rather than as an axis. The full
              names live in each bar's title and screen-reader text. */}
          <ul className="stats-hour-axis" aria-hidden="true">
            {hours.map((slot) => (
              <li key={slot.h} className="stats-hour-label">
                {formatHourTick(slot.h)}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
};
