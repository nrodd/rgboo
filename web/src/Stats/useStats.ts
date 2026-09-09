import { useEffect, useState } from "react";
import { fetchStats, type StatsResponse } from "./stats-api";

type StatsState = {
  stats: StatsResponse | null;
  /** True until the first load settles, either way. */
  isLoading: boolean;
};

export const useStats = (): StatsState => {
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();

    fetchStats(controller.signal)
      .then((next) => {
        if (!controller.signal.aborted) setStats(next);
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        // The page shows the coming-soon placeholder rather than an error: a
        // visitor can do nothing about a failed fetch, and cannot tell it
        // apart from "no data yet" anyway. The console keeps it diagnosable.
        console.error("Failed to load stats", error);
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });

    return () => controller.abort();
  }, []);

  return { stats, isLoading };
};
