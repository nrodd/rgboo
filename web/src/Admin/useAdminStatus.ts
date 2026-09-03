import { useCallback, useEffect, useRef, useState } from "react";
import { fetchStatus, type AdminStatus } from "./admin-api";

const POLL_INTERVAL_MS = 6_000;
// When the API is unreachable, back off instead of hammering a cold-starting
// Cloud Run instance every 6s. Doubles per failure up to this ceiling.
const MAX_BACKOFF_MS = 60_000;

type RefreshResult = "ok" | "error" | "skipped";

const queueChanged = (previous: AdminStatus | null, next: AdminStatus) =>
  !!previous && (
    previous.current_username !== next.current_username ||
    previous.queue_size !== next.queue_size ||
    previous.queue.some((item, index) => item.request_id !== next.queue[index]?.request_id)
  );

export type AdminStatusState = {
  status: AdminStatus | null;
  error: string;
  isRefreshing: boolean;
  lastUpdated: Date | null;
  liveMessage: string;
  refresh: () => Promise<RefreshResult>;
};

export const useAdminStatus = (): AdminStatusState => {
  const [status, setStatus] = useState<AdminStatus | null>(null);
  const [error, setError] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [liveMessage, setLiveMessage] = useState("Connecting to the queue");
  const refreshingRef = useRef(false);
  const previousStatusRef = useRef<AdminStatus | null>(null);

  const refresh = useCallback(async (): Promise<RefreshResult> => {
    if (refreshingRef.current) return "skipped";
    refreshingRef.current = true;
    setIsRefreshing(true);
    try {
      const next = await fetchStatus();
      const changed = queueChanged(previousStatusRef.current, next);
      previousStatusRef.current = next;
      setStatus(next);
      setLastUpdated(new Date());
      setLiveMessage(changed ? "Queue updated just now" : "Live queue monitoring");
      setError("");
      return "ok";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load queue");
      setLiveMessage("Live updates paused");
      return "error";
    } finally {
      refreshingRef.current = false;
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    let timer: number | undefined;
    let failures = 0;

    const run = async () => {
      if (document.hidden) {
        timer = window.setTimeout(run, POLL_INTERVAL_MS);
        return;
      }
      const result = await refresh();
      if (cancelled) return;
      if (result === "error") failures += 1;
      else if (result === "ok") failures = 0;
      const delay = failures
        ? Math.min(POLL_INTERVAL_MS * 2 ** failures, MAX_BACKOFF_MS)
        : POLL_INTERVAL_MS;
      timer = window.setTimeout(run, delay);
    };

    void run();

    // Surface fresh data the moment the tab is looked at again, without
    // waiting out the current (possibly backed-off) timer.
    const onVisible = () => {
      if (!document.hidden) {
        window.clearTimeout(timer);
        failures = 0;
        void run();
      }
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refresh]);

  return { status, error, isRefreshing, lastUpdated, liveMessage, refresh };
};
