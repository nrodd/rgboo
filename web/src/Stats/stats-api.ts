/**
 * Public stats API client.
 *
 * Relative path, so it goes through the Cloudflare Worker in production
 * (which adds the upstream credential) and Vite's proxy in dev, exactly
 * like the colour form. Nothing here is admin-only.
 */

/** One colour family, ranked across the whole window. It is a grid row. */
export type ColorRow = {
  key: string;
  label: string;
  hex: string | null;
  count: number;
  share: number;
};

/** One colour people picked, and how many times, across the window. */
export type Swatch = { hex: string; n: number };

export type StatsDay = {
  date: string;
  count: number;
  /** Colour-bin key -> how many that day. Bins with none are omitted. */
  colors: Record<string, number>;
};

/** Total submissions in this hour of day, summed across the window. */
export type HourSlot = { h: number; n: number };

export type StatsTotals = {
  count: number;
  active_days: number;
  avg_per_active_day: number;
  busiest_day: { date: string; count: number } | null;
  busiest_hour: { hour: number; count: number } | null;
  hours: HourSlot[];
  colors: ColorRow[];
  /** Every colour picked, already ordered so it reads as a spectrum. */
  swatches: Swatch[];
};

export type StatsResponse = {
  timezone: string;
  days: number;
  start_date: string;
  end_date: string;
  generated_at: string;
  /** When the aggregates were last rebuilt, or null if they never have been. */
  updated_at: string | null;
  totals: StatsTotals;
  grid: StatsDay[];
};

export const RANGE_PRESETS = [7, 30, 90] as const;

export const fetchStats = async (days: number): Promise<StatsResponse> => {
  const response = await fetch(`/api/stats?days=${days}`);
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || "Unable to load stats");
  return body as StatsResponse;
};
