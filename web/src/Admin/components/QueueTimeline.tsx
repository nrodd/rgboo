import { formatWait } from "../format";
import type { QueueItem } from "../admin-api";

type QueueRowProps = {
  item: QueueItem;
  index: number;
  total: number;
  onRemove: () => void;
  isRemoving: boolean;
};

const QueueRow = ({ item, index, total, onRemove, isRemoving }: QueueRowProps) => (
  <li className="group flex items-center gap-3 rounded-2xl px-3 py-4 transition-colors duration-300 hover:bg-white/[0.045] sm:gap-5">
    <div className="relative flex w-10 shrink-0 justify-center self-stretch">
      {index < total - 1 && <span className="absolute top-10 h-[calc(100%+0.8rem)] w-px bg-white/10" />}
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
    <button onClick={onRemove} disabled={isRemoving} className="admin-remove-button" aria-label={`Remove ${item.username} from queue`}>
      {isRemoving ? "Removing…" : "Remove"}
    </button>
  </li>
);

type QueueTimelineProps = {
  queue: QueueItem[];
  queueSize: number;
  onClearQueue: () => void;
  isClearingQueue: boolean;
  onRemove: (requestId: string) => void;
  isRemoving: (requestId: string) => boolean;
};

export const QueueTimeline = ({ queue, queueSize, onClearQueue, isClearingQueue, onRemove, isRemoving }: QueueTimelineProps) => (
  <section className="overflow-hidden rounded-3xl border border-white/10 bg-[#1b1020]/75 shadow-2xl shadow-black/20 backdrop-blur-sm">
    <div className="flex flex-col gap-4 border-b border-white/10 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-pumpkin-400">Run of show</p>
        <h2 className="mt-1 text-2xl font-bold tracking-tight text-white">Queue timeline</h2>
      </div>
      <button onClick={onClearQueue} disabled={queueSize === 0 || isClearingQueue} className="admin-danger-button">
        {isClearingQueue ? "Clearing queue…" : "Clear queue"}
      </button>
    </div>

    {queue.length === 0 ? (
      <div className="flex min-h-72 flex-col items-center justify-center px-6 text-center">
        <span className="flex h-16 w-16 items-center justify-center rounded-full border border-dashed border-pumpkin-400/50 bg-pumpkin-400/10 text-2xl text-pumpkin-400">✦</span>
        <h3 className="mt-5 text-xl font-bold text-white">The queue is clear</h3>
        <p className="mt-2 max-w-sm text-sm text-bone/60">New color requests will arrive here automatically.</p>
      </div>
    ) : (
      <ol className="divide-y divide-white/8 px-3 py-2 sm:px-6">
        {queue.map((item, index) => (
          <QueueRow
            key={item.request_id}
            item={item}
            index={index}
            total={queue.length}
            onRemove={() => onRemove(item.request_id)}
            isRemoving={isRemoving(item.request_id)}
          />
        ))}
      </ol>
    )}
    {queueSize > queue.length && <p className="border-t border-white/10 px-6 py-4 text-center text-xs text-bone/50">Showing the first {queue.length} of {queueSize} requests.</p>}
  </section>
);
