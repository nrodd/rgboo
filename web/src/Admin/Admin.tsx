import { useCallback, useState } from "react";
import { clearCurrent, clearQueue, fetchHealth, removeRequest, type HealthResponse } from "./admin-api";
import { useAdminStatus } from "./useAdminStatus";
import { AdminHeader } from "./components/AdminHeader";
import { NowOnDisplayCard, QueueSizeCard, UpNextCard } from "./components/StatusCards";
import { QueueTimeline } from "./components/QueueTimeline";
import { HealthPanel } from "./components/HealthPanel";

const Admin = () => {
  const { status, error, isRefreshing, lastUpdated, liveMessage, refresh } = useAdminStatus();
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [actionError, setActionError] = useState("");
  // One key per in-flight action, so each button shows its own spinner and only
  // that button is disabled — a running action no longer greys out the page.
  const [pending, setPending] = useState<Set<string>>(new Set());

  const isPending = useCallback((key: string) => pending.has(key), [pending]);

  const runAction = useCallback(async (key: string, run: () => Promise<unknown>, options: { confirm?: string; refresh?: boolean } = {}) => {
    if (options.confirm && !window.confirm(options.confirm)) return;
    setPending((prev) => new Set(prev).add(key));
    setActionError("");
    try {
      await run();
      if (options.refresh !== false) await refresh();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setPending((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  }, [refresh]);

  const checkHealth = () =>
    runAction("health", async () => setHealth(await fetchHealth()), { refresh: false });

  const bannerError = actionError || error;

  return (
    <main className="admin-shell min-h-dvh px-5 py-6 text-bone sm:px-8 sm:py-10">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <AdminHeader error={error} isRefreshing={isRefreshing} liveMessage={liveMessage} lastUpdated={lastUpdated} />

        {bannerError && <p role="alert" className="rounded-2xl border border-red-400/40 bg-red-950/50 px-5 py-4 text-sm text-red-100">{bannerError}</p>}

        {!status && !error && (
          <section className="grid gap-4 md:grid-cols-3" aria-label="Loading queue">
            {[0, 1, 2].map((item) => <div key={item} className="h-40 animate-pulse rounded-3xl border border-white/10 bg-white/5" />)}
          </section>
        )}

        {status && <>
          <section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr_0.8fr]">
            <NowOnDisplayCard
              currentUsername={status.current_username}
              isClearing={isPending("clear-current")}
              onClear={() => void runAction("clear-current", clearCurrent, { confirm: "Clear the current user from the overlay?" })}
            />
            <QueueSizeCard queueSize={status.queue_size} />
            <UpNextCard nextItem={status.queue[0]} onRefresh={() => void refresh()} isRefreshing={isRefreshing} />
          </section>

          <QueueTimeline
            queue={status.queue}
            queueSize={status.queue_size}
            isClearingQueue={isPending("clear-queue")}
            onClearQueue={() => void runAction("clear-queue", clearQueue, { confirm: "Clear the entire pending queue?" })}
            isRemoving={(requestId) => isPending(requestId)}
            onRemove={(requestId) => {
              const item = status.queue.find((entry) => entry.request_id === requestId);
              void runAction(requestId, () => removeRequest(requestId), { confirm: `Remove this request for ${item?.username ?? "this guest"}?` });
            }}
          />
        </>}

        <HealthPanel health={health} onCheck={() => void checkHealth()} isChecking={isPending("health")} />
      </div>
    </main>
  );
};

export default Admin;
