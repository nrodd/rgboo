import { useCallback, useEffect, useRef, useState } from "react";
import { fetchStats, type StatsResponse } from "./stats-api";

export type StatsState = {
  stats: StatsResponse | null;
  error: string;
  /** True only for the very first load, when there is nothing to hold on screen. */
  isLoading: boolean;
  /** True while a range change is in flight and the previous render is still up. */
  isRefreshing: boolean;
  days: number;
  setDays: (days: number) => void;
};

export const useStats = (initialDays: number): StatsState => {
  const [days, setDays] = useState(initialDays);
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [error, setError] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);
  // Whether anything has ever rendered, so switching ranges holds the old
  // grid at reduced opacity instead of flashing a skeleton over it.
  const hasLoaded = useRef(false);

  const load = useCallback(async (requested: number, signal: AbortSignal) => {
    setIsRefreshing(true);
    try {
      const next = await fetchStats(requested);
      if (signal.aborted) return;
      setStats(next);
      setError("");
      hasLoaded.current = true;
    } catch (err) {
      if (signal.aborted) return;
      setError(err instanceof Error ? err.message : "Unable to load stats");
    } finally {
      if (!signal.aborted) setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    // Aborting means a fast double-click on the range buttons can't land an
    // older response after a newer one.
    const controller = new AbortController();
    void load(days, controller.signal);
    return () => controller.abort();
  }, [days, load]);

  return {
    stats,
    error,
    isLoading: !hasLoaded.current && !error,
    isRefreshing,
    days,
    setDays,
  };
};
