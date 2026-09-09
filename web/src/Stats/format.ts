/** Formatting helpers for the stats page. */

/**
 * A compact axis tick: "12a", then bare numbers, then "12p".
 *
 * A full day is 24 ticks. Spelled out ("11 PM") they are wider than the
 * column they label, so the last one gets clipped by the scrolling
 * wrapper. Anchoring the two noons and numbering between them keeps every
 * bar labelled and still reads as a clock.
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
 * Parse a YYYY-MM-DD day id without letting the browser's timezone move it.
 * `new Date("2026-09-08")` is parsed as UTC midnight, which renders as the
 * 7th for anyone west of Greenwich -- the exact off-by-one-day the server
 * side takes care to avoid.
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

/**
 * Composite a #rrggbb over the page at a given alpha.
 *
 * Used instead of CSS `opacity` so a cell's presence ring stays at full
 * strength however quiet the day was.
 */
export const hexToRgba = (hex: string, alpha: number) => {
  const value = hex.replace("#", "");
  const full = value.length === 3 ? value.split("").map((c) => c + c).join("") : value;
  const int = Number.parseInt(full, 16);
  if (Number.isNaN(int) || full.length !== 6) return `rgba(235, 219, 190, ${alpha})`;
  return `rgba(${(int >> 16) & 255}, ${(int >> 8) & 255}, ${int & 255}, ${alpha})`;
};

const toRgb = (hex: string) => {
  const value = hex.replace("#", "");
  const full = value.length === 3 ? value.split("").map((c) => c + c).join("") : value;
  const int = Number.parseInt(full, 16);
  if (Number.isNaN(int) || full.length !== 6) return null;
  return [(int >> 16) & 255, (int >> 8) & 255, int & 255] as const;
};

const RAMP_LIGHTNESS_FLOOR = 0.42;

/**
 * A version of a colour guaranteed to be visible on the dark card.
 *
 * The "near black" family averages to something like #111016, which is all
 * but identical to the surface behind it -- its whole row would render as
 * an empty row whatever the counts were. Only the *ramp* uses this; the row
 * header swatch and the tooltip show the true measured colour, so nothing
 * is misstated, the dark row is just drawn in a legible proxy of itself.
 */
export const rampHex = (hex: string) => {
  const rgb = toRgb(hex);
  if (!rgb) return hex;

  const [r, g, b] = rgb;
  const lightness = (Math.max(r, g, b) + Math.min(r, g, b)) / 2 / 255;
  if (lightness >= RAMP_LIGHTNESS_FLOOR) return hex;

  const floor = RAMP_LIGHTNESS_FLOOR * 255;
  // Scaling all three channels by the same factor leaves their ratios --
  // and so the hue -- untouched. Pure black has no ratios to preserve, so
  // it becomes a neutral grey at the floor.
  const scale = lightness === 0 ? 0 : RAMP_LIGHTNESS_FLOOR / lightness;
  const channel = (value: number) =>
    Math.round(Math.max(0, Math.min(255, lightness === 0 ? floor : value * scale)));

  return `#${[channel(r), channel(g), channel(b)]
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("")}`;
};

/**
 * Five discrete intensity steps rather than a continuous ramp.
 *
 * A continuous alpha is not perceivable cell to cell. Five is workable here
 * where four was not on the old grid, because a row holds one fixed hue --
 * the only arrangement in which light-to-dark actually means "more".
 */
export const INTENSITY_STEPS = [0.28, 0.46, 0.64, 0.82, 1] as const;

/**
 * Where a count falls on the scale, on a square-root ramp.
 *
 * Nightly counts are heavily skewed: one big night can be ten times a
 * typical one, and under linear normalisation that single cell takes the
 * top step while everything else collapses into the bottom one -- the grid
 * then reads as little more than present/absent. A square root spreads the
 * middle out again while staying monotonic, so more still always looks like
 * more.
 */
export const intensityFor = (count: number, peak: number) => {
  if (count <= 0) return 0;
  if (peak <= 1) return INTENSITY_STEPS[INTENSITY_STEPS.length - 1];
  const ratio = Math.sqrt(count) / Math.sqrt(peak);
  const index = Math.min(
    INTENSITY_STEPS.length - 1,
    Math.floor(ratio * INTENSITY_STEPS.length - 1e-9),
  );
  return INTENSITY_STEPS[Math.max(0, index)];
};
