import { useCallback, useEffect, useRef, useState } from "react";
import { fetchStats, type StatsResponse } from "./stats-api";

type StatsState = {
  stats: StatsResponse | null;
  error: string;
  /** True only for the very first load, when there is nothing to hold on screen. */
  isLoading: boolean;
  /** True while a reload is in flight and the previous render is still up. */
  isRefreshing: boolean;
};

export const useStats = (): StatsState => {
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [error, setError] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);
  // So a reload dims the old page instead of flashing a skeleton over it.
  const hasLoaded = useRef(false);

  const load = useCallback(async (signal: AbortSignal) => {
    setIsRefreshing(true);
    try {
      const next = await fetchStats();
      if (signal.aborted) return;
      setStats(next);
      setError("");
      hasLoaded.current = true;
    } catch (err) {
      if (signal.aborted) return;
      // Shown as the coming-soon card, not an error: a visitor can do
      // nothing about a failed fetch. The console keeps it diagnosable.
      console.error("Failed to load stats", err);
      setError(err instanceof Error ? err.message : "Unable to load stats");
    } finally {
      if (!signal.aborted) setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    // Keeps a response from a torn-down mount out of state.
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  return {
    stats,
    error,
    isLoading: !hasLoaded.current && !error,
    isRefreshing,
  };
};
