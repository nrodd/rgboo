/** Formatting helpers for the stats page. */

/**
 * A compact axis tick: "12a", then bare numbers, then "12p".
 *
 * Spelled out ("11 PM"), 24 ticks are wider than the columns they label and
 * the last one clips.
 */
export const formatHourTick = (hour: number) => {
  if (hour === 0) return "12a";
  if (hour === 12) return "12p";
  return String(hour % 12);
};

/** "8 PM", "12 AM" -- how a person names an hour, not "20:00". */
export const formatHour = (hour: number) => {
  const suffix = hour < 12 ? "AM" : "PM";
  const twelve = hour % 12 === 0 ? 12 : hour % 12;
  return `${twelve} ${suffix}`;
};

/**
 * Parse a YYYY-MM-DD day id in local time. `new Date("2026-09-08")` is UTC
 * midnight, which renders as the 7th west of Greenwich.
 */
const parseDay = (iso: string) => {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year, month - 1, day);
};

/** "Tue, Sep 8" -- for tooltips and table rows. */
export const formatDayLong = (iso: string) =>
  parseDay(iso).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

export const formatCount = (value: number) => value.toLocaleString();

export const formatShare = (share: number) => `${Math.round(share * 100)}%`;

/** "colour" / "colours", so tooltips and tiles read like sentences. */
export const pluralise = (count: number, word: string) =>
  `${formatCount(count)} ${word}${count === 1 ? "" : "s"}`;

export const formatUpdatedAt = (iso: string | null) => {
  if (!iso) return "never";
  const when = new Date(iso);
  if (Number.isNaN(when.getTime())) return "never";
  return when.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};
