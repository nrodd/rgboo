import { useCallback, useEffect, useState } from "react";

type QueueItem = { request_id: string; username: string; queue_position: number };
type AdminStatus = { current_username: string | null; queue: QueueItem[]; queue_size: number };

const Admin = () => {
  const [status, setStatus] = useState<AdminStatus | null>(null);
  const [health, setHealth] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const request = useCallback(async (path: string, options: RequestInit = {}) => {
    const response = await fetch(path, { ...options, headers: { "Content-Type": "application/json", ...options.headers } });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || body.message || "Request failed");
    return body;
  }, []);
  const refresh = useCallback(async () => {
    setBusy(true); setError("");
    try { setStatus(await request("/admin-api/status")); }
    catch (err) { setError(err instanceof Error ? err.message : "Unable to load queue"); }
    finally { setBusy(false); }
  }, [request]);
  useEffect(() => { void refresh(); }, [refresh]);
  const action = async (path: string, message: string, body?: string) => {
    if (!window.confirm(message)) return;
    setBusy(true); setError("");
    try { await request(path, { method: "POST", body }); await refresh(); }
    catch (err) { setError(err instanceof Error ? err.message : "Action failed"); setBusy(false); }
  };
  const checkHealth = async () => {
    setBusy(true); setError("");
    try { setHealth(await request("/admin-api/health")); }
    catch (err) { setError(err instanceof Error ? err.message : "Health check failed"); }
    finally { setBusy(false); }
  };
  return <main className="min-h-dvh px-6 py-10 text-bone sm:px-12"><div className="mx-auto flex max-w-4xl flex-col gap-8">
    <header><p className="text-sm uppercase tracking-widest text-pumpkin-400">RGBoo control room</p><h1 className="text-md font-bold">Queue admin</h1></header>
    {error && <p role="alert" className="rounded-md border border-red-400 bg-red-950/60 p-4">{error}</p>}
    {status && <><section className="grid gap-5 sm:grid-cols-2">
      <div className="rounded-md border border-pumpkin-400 p-5"><p className="text-sm uppercase opacity-70">Current user</p><p className="mt-2 text-md font-bold">{status.current_username || "Nobody"}</p><button onClick={() => void action("/admin-api/clear-current", "Clear the current user from the overlay?", "{}")} disabled={busy || !status.current_username} className="form-field form-button mt-5 w-full px-4">Clear current user</button></div>
      <div className="rounded-md border border-pumpkin-600 p-5"><p className="text-sm uppercase opacity-70">Queue</p><p className="mt-2 text-md font-bold">{status.queue_size} pending</p><button onClick={() => void action("/admin-api/queue/clear", "Clear the entire pending queue?")} disabled={busy || status.queue_size === 0} className="form-field form-button mt-5 w-full px-4">Clear entire queue</button></div>
    </section><section className="rounded-md border border-pumpkin-600 p-5"><div className="mb-4 flex items-center justify-between"><h2 className="text-base font-bold">Next up</h2><button onClick={() => void refresh()} disabled={busy} className="rounded border border-pumpkin-400 px-3 py-1 text-sm">Refresh</button></div>
      {status.queue.length === 0 ? <p className="opacity-70">The queue is empty.</p> : <ol>{status.queue.map((item) => <li key={item.request_id} className="flex items-center justify-between gap-4 border-t border-pumpkin-600/60 py-3"><span><span className="mr-3 opacity-60">#{item.queue_position}</span><span className="font-bold">{item.username}</span></span><button onClick={() => void action("/admin-api/queue/remove", `Remove this request for ${item.username}?`, JSON.stringify({ request_id: item.request_id }))} disabled={busy} className="rounded border border-red-400 px-3 py-1 text-sm">Remove</button></li>)}</ol>}
    </section></>}
    <section className="rounded-md border border-pumpkin-600 p-5"><div className="flex items-center justify-between"><h2 className="text-base font-bold">API health</h2><button onClick={() => void checkHealth()} disabled={busy} className="form-field form-button px-4">Check health</button></div>{health && <pre className="mt-4 overflow-auto text-sm opacity-80">{JSON.stringify(health, null, 2)}</pre>}</section>
  </div></main>;
};

export default Admin;
