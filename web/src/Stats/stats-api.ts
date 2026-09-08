/**
 * Public stats API client.
 *
 * Relative path, so it goes through the Cloudflare Worker in production
 * (which adds the upstream credential) and Vite's proxy in dev, exactly
 * like the colour form. Nothing here is admin-only.
 */

/** One populated hour. Empty hours are omitted by the API, not sent as zeroes. */
export type StatsCell = {
  h: number;
  n: number;
  /** Mean of the most-submitted hue bin that hour. Absent only if n is 0. */
  hex?: string;
  label?: string;
};

export type StatsDay = {
  date: string;
  count: number;
  hours: StatsCell[];
};

export type TopColor = {
  key: string;
  label: string;
  hex: string | null;
  count: number;
  share: number;
};

export type StatsTotals = {
  count: number;
  active_days: number;
  avg_per_active_day: number;
  busiest_day: { date: string; count: number } | null;
  busiest_hour: { hour: number; count: number } | null;
  peak_hour_count: number;
  top_colors: TopColor[];
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
