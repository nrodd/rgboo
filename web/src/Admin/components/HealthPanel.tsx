import type { HealthResponse } from "../admin-api";

type HealthPanelProps = {
  health: HealthResponse | null;
  onCheck: () => void;
  isChecking: boolean;
};

const Pill = ({ label, ok }: { label: string; ok: boolean }) => (
  <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-bone/75">
    <span className={`h-2 w-2 rounded-full ${ok ? "bg-emerald-400" : "bg-red-400"}`} />
    {label}
  </span>
);

export const HealthPanel = ({ health, onCheck, isChecking }: HealthPanelProps) => (
  <section className="rounded-2xl border border-white/10 bg-white/[0.025] px-5 py-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <p className="text-sm font-bold text-white">System connection</p>
        <p className="mt-1 text-xs text-bone/50">Run a manual health check when you need more detail.</p>
      </div>
      <button onClick={onCheck} disabled={isChecking} className="admin-quiet-button">{isChecking ? "Checking…" : "Check health"}</button>
    </div>
    {health && (
      <div className="mt-4 flex flex-col gap-3">
        <div className="flex flex-wrap gap-2">
          <Pill label="Bridge online" ok={!!health.bridge_online} />
          <Pill label="Serial connected" ok={!!health.serial_connected} />
        </div>
        <pre className="max-h-56 overflow-auto rounded-xl border border-white/8 bg-black/20 p-4 text-xs leading-relaxed text-bone/70">{JSON.stringify(health, null, 2)}</pre>
      </div>
    )}
  </section>
);
