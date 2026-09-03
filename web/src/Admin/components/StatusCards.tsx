import { formatWait } from "../format";
import type { QueueItem } from "../admin-api";

type NowOnDisplayCardProps = {
  currentUsername: string | null;
  onClear: () => void;
  isClearing: boolean;
};

export const NowOnDisplayCard = ({ currentUsername, onClear, isClearing }: NowOnDisplayCardProps) => (
  <article className="relative overflow-hidden rounded-3xl border border-pumpkin-400/40 bg-linear-to-br from-pumpkin-400/25 via-pumpkin-900/80 to-arcana-900 p-6 shadow-2xl shadow-pumpkin-900/20">
    <div className="absolute -right-12 -top-12 h-36 w-36 rounded-full bg-pumpkin-400/20 blur-2xl" />
    <div className="relative flex items-start justify-between gap-4">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-pumpkin-400">Now on display</p>
        <p className="mt-4 truncate text-3xl font-bold tracking-tight text-white sm:text-4xl">{currentUsername || "Waiting for a guest"}</p>
        <p className="mt-2 text-sm text-bone/65">{currentUsername ? "This request is live on the overlay." : "The next queued guest will appear here."}</p>
      </div>
      <span className={`mt-1 h-3 w-3 shrink-0 rounded-full ${currentUsername ? "bg-pumpkin-400 shadow-[0_0_16px_#E36810]" : "bg-white/25"}`} />
    </div>
    <button onClick={onClear} disabled={!currentUsername || isClearing} className="admin-secondary-button mt-6 w-full">
      {isClearing ? "Clearing…" : "Clear current display"}
    </button>
  </article>
);

export const QueueSizeCard = ({ queueSize }: { queueSize: number }) => (
  <article className="rounded-3xl border border-white/10 bg-white/[0.045] p-6 backdrop-blur-sm">
    <p className="text-xs font-bold uppercase tracking-[0.2em] text-bone/45">In the wings</p>
    <p className="mt-5 text-5xl font-bold tracking-tight text-white">{queueSize}</p>
    <p className="mt-2 text-sm text-bone/65">{queueSize === 1 ? "guest waiting" : "guests waiting"}</p>
    <div className="mt-7 h-2 overflow-hidden rounded-full bg-white/10">
      <div className="h-full rounded-full bg-linear-to-r from-pumpkin-400 to-[#ffaf5c] transition-all duration-700" style={{ width: `${Math.min(100, Math.max(8, queueSize * 10))}%` }} />
    </div>
  </article>
);

type UpNextCardProps = {
  nextItem?: QueueItem;
  onRefresh: () => void;
  isRefreshing: boolean;
};

export const UpNextCard = ({ nextItem, onRefresh, isRefreshing }: UpNextCardProps) => (
  <article className="rounded-3xl border border-white/10 bg-white/[0.045] p-6 backdrop-blur-sm">
    <p className="text-xs font-bold uppercase tracking-[0.2em] text-bone/45">Up next</p>
    <p className="mt-5 truncate text-3xl font-bold tracking-tight text-white">{nextItem?.username || "—"}</p>
    <p className="mt-2 text-sm text-bone/65">{nextItem ? formatWait(nextItem.estimated_wait_seconds) : "No requests queued"}</p>
    <button onClick={onRefresh} disabled={isRefreshing} className="admin-quiet-button mt-6 w-full">
      <span className={isRefreshing ? "inline-block animate-spin" : "inline-block"}>↻</span> {isRefreshing ? "Syncing…" : "Refresh now"}
    </button>
  </article>
);
