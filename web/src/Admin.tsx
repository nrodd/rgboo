import { useCallback, useEffect, useRef, useState } from "react";

type QueueItem = {
  request_id: string;
  username: string;
  queue_position: number;
  estimated_wait_seconds?: number;
  scheduled_time?: string;
};

type AdminStatus = {
  current_username: string | null;
  queue: QueueItem[];
  queue_size: number;
};

const POLL_INTERVAL_MS = 6_000;

const formatWait = (seconds?: number) => {
  if (seconds === undefined || seconds <= 0) return "Ready now";
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (!minutes) return `In ${remainingSeconds}s`;
  return `In ${minutes}m${remainingSeconds ? ` ${remainingSeconds}s` : ""}`;
};

const formatSyncTime = (date: Date | null) => {
  if (!date) return "Connecting…";
  return `Synced ${date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit", second: "2-digit" })}`;
};

const Admin = () => {
  const [status, setStatus] = useState<AdminStatus | null>(null);
  const [health, setHealth] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeAction, setActiveAction] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [liveMessage, setLiveMessage] = useState("Connecting to the queue");
  const refreshingRef = useRef(false);
  const previousStatusRef = useRef<AdminStatus | null>(null);

  const request = useCallback(async (path: string, options: RequestInit = {}) => {
    const response = await fetch(path, {
      ...options,
      headers: { "Content-Type": "application/json", ...options.headers },
    });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || body.message || "Request failed");
    return body;
  }, []);

  const refresh = useCallback(async () => {
    if (refreshingRef.current) return;
    refreshingRef.current = true;
    setIsRefreshing(true);

    try {
      const nextStatus = await request("/admin-api/status") as AdminStatus;
      const previousStatus = previousStatusRef.current;
      const queueChanged = previousStatus && (
        previousStatus.current_username !== nextStatus.current_username ||
        previousStatus.queue_size !== nextStatus.queue_size ||
        previousStatus.queue.some((item, index) => item.request_id !== nextStatus.queue[index]?.request_id)
      );

      previousStatusRef.current = nextStatus;
      setStatus(nextStatus);
      setLastUpdated(new Date());
      setLiveMessage(queueChanged ? "Queue updated just now" : "Live queue monitoring");
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load queue");
      setLiveMessage("Live updates paused");
    } finally {
      refreshingRef.current = false;
      setIsRefreshing(false);
    }
  }, [request]);

  useEffect(() => {
    void refresh();
    const interval = window.setInterval(() => {
      if (!document.hidden) void refresh();
    }, POLL_INTERVAL_MS);
    const updateWhenVisible = () => {
      if (!document.hidden) void refresh();
    };
    document.addEventListener("visibilitychange", updateWhenVisible);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", updateWhenVisible);
    };
  }, [refresh]);

  const action = async (path: string, message: string, actionName: string, body?: string) => {
    if (!window.confirm(message)) return;
    setActiveAction(actionName);
    setError("");
    try {
      await request(path, { method: "POST", body });
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setActiveAction(null);
    }
  };

  const checkHealth = async () => {
    setActiveAction("health");
    setError("");
    try {
      setHealth(await request("/admin-api/health"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Health check failed");
    } finally {
      setActiveAction(null);
    }
  };

  return (
    <main className="admin-shell min-h-dvh px-5 py-6 text-bone sm:px-8 sm:py-10">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <header className="flex flex-col gap-5 border-b border-white/10 pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-pumpkin-400">RGBoo control room</p>
            <h1 className="mt-2 text-4xl font-bold tracking-tight text-white sm:text-5xl">Queue dashboard</h1>
            <p className="mt-2 text-sm text-bone/65">Keep the show moving, one color request at a time.</p>
          </div>
          <div className="flex items-center gap-3 self-start rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-bone/75 sm:self-auto" aria-live="polite">
            <span className={`h-2.5 w-2.5 rounded-full ${error ? "bg-red-400" : "bg-emerald-400"} ${isRefreshing ? "animate-pulse" : ""}`} />
            <span>{error ? "Connection needs attention" : liveMessage}</span>
            <span className="hidden border-l border-white/15 pl-3 text-bone/45 sm:inline">{formatSyncTime(lastUpdated)}</span>
          </div>
        </header>

        {error && <p role="alert" className="rounded-2xl border border-red-400/40 bg-red-950/50 px-5 py-4 text-sm text-red-100">{error}</p>}

        {!status && !error && (
          <section className="grid gap-4 md:grid-cols-3" aria-label="Loading queue">
            {[0, 1, 2].map((item) => <div key={item} className="h-40 animate-pulse rounded-3xl border border-white/10 bg-white/5" />)}
          </section>
        )}

        {status && <>
          <section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr_0.8fr]">
            <article className="relative overflow-hidden rounded-3xl border border-pumpkin-400/40 bg-linear-to-br from-pumpkin-400/25 via-pumpkin-900/80 to-arcana-900 p-6 shadow-2xl shadow-pumpkin-900/20">
              <div className="absolute -right-12 -top-12 h-36 w-36 rounded-full bg-pumpkin-400/20 blur-2xl" />
              <div className="relative flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-pumpkin-400">Now on display</p>
                  <p className="mt-4 truncate text-3xl font-bold tracking-tight text-white sm:text-4xl">{status.current_username || "Waiting for a guest"}</p>
                  <p className="mt-2 text-sm text-bone/65">{status.current_username ? "This request is live on the overlay." : "The next queued guest will appear here."}</p>
                </div>
                <span className={`mt-1 h-3 w-3 shrink-0 rounded-full ${status.current_username ? "bg-pumpkin-400 shadow-[0_0_16px_#E36810]" : "bg-white/25"}`} />
              </div>
              <button onClick={() => void action("/admin-api/clear-current", "Clear the current user from the overlay?", "clear-current", "{}")} disabled={!status.current_username || activeAction !== null} className="admin-secondary-button mt-6 w-full">
                {activeAction === "clear-current" ? "Clearing…" : "Clear current display"}
              </button>
            </article>

            <article className="rounded-3xl border border-white/10 bg-white/[0.045] p-6 backdrop-blur-sm">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-bone/45">In the wings</p>
              <p className="mt-5 text-5xl font-bold tracking-tight text-white">{status.queue_size}</p>
              <p className="mt-2 text-sm text-bone/65">{status.queue_size === 1 ? "guest waiting" : "guests waiting"}</p>
              <div className="mt-7 h-2 overflow-hidden rounded-full bg-white/10">
                <div className="h-full rounded-full bg-linear-to-r from-pumpkin-400 to-[#ffaf5c] transition-all duration-700" style={{ width: `${Math.min(100, Math.max(8, status.queue_size * 10))}%` }} />
              </div>
            </article>

            <article className="rounded-3xl border border-white/10 bg-white/[0.045] p-6 backdrop-blur-sm">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-bone/45">Up next</p>
              <p className="mt-5 truncate text-3xl font-bold tracking-tight text-white">{status.queue[0]?.username || "—"}</p>
              <p className="mt-2 text-sm text-bone/65">{status.queue[0] ? formatWait(status.queue[0].estimated_wait_seconds) : "No requests queued"}</p>
              <button onClick={() => void refresh()} disabled={activeAction !== null || isRefreshing} className="admin-quiet-button mt-6 w-full">
                <span className={isRefreshing ? "inline-block animate-spin" : "inline-block"}>↻</span> {isRefreshing ? "Syncing…" : "Refresh now"}
              </button>
            </article>
          </section>

          <section className="overflow-hidden rounded-3xl border border-white/10 bg-[#1b1020]/75 shadow-2xl shadow-black/20 backdrop-blur-sm">
            <div className="flex flex-col gap-4 border-b border-white/10 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-pumpkin-400">Run of show</p>
                <h2 className="mt-1 text-2xl font-bold tracking-tight text-white">Queue timeline</h2>
              </div>
              <button onClick={() => void action("/admin-api/queue/clear", "Clear the entire pending queue?", "clear-queue")} disabled={status.queue_size === 0 || activeAction !== null} className="admin-danger-button">
                {activeAction === "clear-queue" ? "Clearing queue…" : "Clear queue"}
              </button>
            </div>

            {status.queue.length === 0 ? (
              <div className="flex min-h-72 flex-col items-center justify-center px-6 text-center">
                <span className="flex h-16 w-16 items-center justify-center rounded-full border border-dashed border-pumpkin-400/50 bg-pumpkin-400/10 text-2xl text-pumpkin-400">✦</span>
                <h3 className="mt-5 text-xl font-bold text-white">The queue is clear</h3>
                <p className="mt-2 max-w-sm text-sm text-bone/60">New color requests will arrive here automatically.</p>
              </div>
            ) : (
              <ol className="divide-y divide-white/8 px-3 py-2 sm:px-6">
                {status.queue.map((item, index) => (
                  <li key={item.request_id} className="group flex items-center gap-3 rounded-2xl px-3 py-4 transition-colors duration-300 hover:bg-white/[0.045] sm:gap-5">
                    <div className="relative flex w-10 shrink-0 justify-center self-stretch">
                      {index < status.queue.length - 1 && <span className="absolute top-10 h-[calc(100%+0.8rem)] w-px bg-white/10" />}
                      <span className={`relative z-10 flex h-10 w-10 items-center justify-center rounded-full border text-sm font-bold ${index === 0 ? "border-pumpkin-400 bg-pumpkin-400 text-arcana-900" : "border-white/15 bg-white/5 text-bone/65"}`}>{item.queue_position}</span>
                    </div>
                    <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-lg font-bold ${index === 0 ? "bg-pumpkin-400/15 text-pumpkin-400" : "bg-white/7 text-bone/70"}`}>{item.username.slice(0, 1).toUpperCase()}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        <p className="truncate text-lg font-bold text-white">{item.username}</p>
                        {index === 0 && <span className="rounded-full bg-pumpkin-400/15 px-2 py-0.5 text-[0.65rem] font-bold uppercase tracking-wider text-pumpkin-400">Up next</span>}
                      </div>
                      <p className="mt-1 text-xs font-medium text-bone/50">{formatWait(item.estimated_wait_seconds)}{item.scheduled_time ? ` · scheduled ${new Date(item.scheduled_time).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}` : ""}</p>
                    </div>
                    <button onClick={() => void action("/admin-api/queue/remove", `Remove this request for ${item.username}?`, item.request_id, JSON.stringify({ request_id: item.request_id }))} disabled={activeAction !== null} className="admin-remove-button" aria-label={`Remove ${item.username} from queue`}>
                      {activeAction === item.request_id ? "Removing…" : "Remove"}
                    </button>
                  </li>
                ))}
              </ol>
            )}
            {status.queue_size > status.queue.length && <p className="border-t border-white/10 px-6 py-4 text-center text-xs text-bone/50">Showing the first {status.queue.length} of {status.queue_size} requests.</p>}
          </section>
        </>}

        <section className="rounded-2xl border border-white/10 bg-white/[0.025] px-5 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><p className="text-sm font-bold text-white">System connection</p><p className="mt-1 text-xs text-bone/50">Run a manual health check when you need more detail.</p></div>
            <button onClick={() => void checkHealth()} disabled={activeAction !== null} className="admin-quiet-button">{activeAction === "health" ? "Checking…" : "Check health"}</button>
          </div>
          {health && <pre className="mt-4 max-h-56 overflow-auto rounded-xl border border-white/8 bg-black/20 p-4 text-xs leading-relaxed text-bone/70">{JSON.stringify(health, null, 2)}</pre>}
        </section>
      </div>
    </main>
  );
};

export default Admin;
