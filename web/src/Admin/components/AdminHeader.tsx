import { formatSyncTime } from "../format";

type AdminHeaderProps = {
  error: string;
  isRefreshing: boolean;
  liveMessage: string;
  lastUpdated: Date | null;
};

export const AdminHeader = ({ error, isRefreshing, liveMessage, lastUpdated }: AdminHeaderProps) => (
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
);
