/**
 * Admin dashboard API client.
 *
 * All paths are relative, so they go through the Cloudflare Worker in
 * production (which adds the upstream credential) and Vite's authenticated
 * proxy during local dev. The browser never holds an API secret.
 */

export type QueueItem = {
  request_id: string;
  username: string;
  queue_position: number;
  estimated_wait_seconds?: number;
  scheduled_time?: string;
};

export type AdminStatus = {
  current_username: string | null;
  queue: QueueItem[];
  queue_size: number;
};

export type HealthResponse = {
  status?: string;
  service?: string;
  timestamp?: string;
  bridge_online?: boolean;
  serial_connected?: boolean | null;
  [key: string]: unknown;
};

const request = async <T>(path: string, options: RequestInit = {}): Promise<T> => {
  const response = await fetch(path, {
    ...options,
    headers: { "Content-Type": "application/json", ...options.headers },
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || body.message || "Request failed");
  return body as T;
};

export const fetchStatus = () => request<AdminStatus>("/admin-api/status");

export const fetchHealth = () => request<HealthResponse>("/admin-api/health");

export const clearCurrent = () =>
  request("/admin-api/clear-current", { method: "POST", body: "{}" });

export const clearQueue = () =>
  request("/admin-api/queue/clear", { method: "POST" });

export const removeRequest = (requestId: string) =>
  request("/admin-api/queue/remove", {
    method: "POST",
    body: JSON.stringify({ request_id: requestId }),
  });
