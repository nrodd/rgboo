/** Formatting helpers for the stats page. */

/** "8 PM", "12 AM" -- how a person names an hour, not "20:00". */
export const formatHour = (hour: number) => {
  const suffix = hour < 12 ? "AM" : "PM";
  const twelve = hour % 12 === 0 ? 12 : hour % 12;
  return `${twelve} ${suffix}`;
};

/**
 * Parse a YYYY-MM-DD day id without letting the browser's timezone move it.
 * `new Date("2026-09-08")` is parsed as UTC midnight, which renders as the
 * 7th for anyone west of Greenwich -- the exact off-by-one-day the server
 * side takes care to avoid.
 */
const parseDay = (iso: string) => {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year, month - 1, day);
};

/** "Sep 8" -- for axis ticks. */
export const formatDayShort = (iso: string) =>
  parseDay(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });

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

/**
 * Composite a #rrggbb over the page at a given alpha.
 *
 * Used instead of CSS `opacity` so the cell's presence ring stays at full
 * strength: a quiet hour of near-black has to stay distinguishable from an
 * hour when nobody submitted anything at all.
 */
export const hexToRgba = (hex: string, alpha: number) => {
  const value = hex.replace("#", "");
  const full = value.length === 3 ? value.split("").map((c) => c + c).join("") : value;
  const int = Number.parseInt(full, 16);
  if (Number.isNaN(int) || full.length !== 6) return `rgba(235, 219, 190, ${alpha})`;
  return `rgba(${(int >> 16) & 255}, ${(int >> 8) & 255}, ${int & 255}, ${alpha})`;
};

/**
 * Four discrete intensity steps rather than a continuous ramp.
 *
 * A continuous alpha is not perceivable cell to cell; four steps are. The
 * quietest step still clears the empty-cell wash so "one colour" never
 * reads as "nothing".
 */
export const INTENSITY_STEPS = [0.4, 0.6, 0.8, 1] as const;

export const intensityFor = (count: number, peak: number) => {
  if (count <= 0) return 0;
  if (peak <= 1) return INTENSITY_STEPS[INTENSITY_STEPS.length - 1];
  const ratio = count / peak;
  const index = Math.min(
    INTENSITY_STEPS.length - 1,
    Math.floor(ratio * INTENSITY_STEPS.length - 1e-9),
  );
  return INTENSITY_STEPS[Math.max(0, index)];
};
