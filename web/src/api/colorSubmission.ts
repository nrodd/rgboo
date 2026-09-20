export interface ColorSubmission { username: string; color: { r: number; g: number; b: number } }
export interface SubmissionResult { kind: "sending" | "success" | "error" | "cooldown"; message: string; position?: number }
let fallbackCooldownEnd = 0;
let inFlight = false;
export function cooldownRemaining() {
  let end = fallbackCooldownEnd;
  try { end = Date.parse(localStorage.getItem("rgboo_cooldown_end") ?? "") || 0; } catch { /* Storage is optional. */ }
  return Math.max(0, Math.ceil((end - Date.now()) / 1000));
}

/** Frog and custom submissions share the same API, cooldown and in-flight guard. */
export function createColorSender(onResult: (result: SubmissionResult) => void) {
  const controller = new AbortController();
  const send = async (payload: ColorSubmission) => {
    if (controller.signal.aborted) return;
    if (inFlight) { onResult({ kind: "error", message: "A color is already being sent. Please wait." }); return; }
    const remaining = cooldownRemaining();
    if (remaining) { onResult({ kind: "cooldown", message: `You can send another color in ${remaining}s.` }); return; }
    inFlight = true;
    onResult({ kind: "sending", message: "Sending your color…" });
    try {
      const response = await fetch("/api/color", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload), signal: controller.signal });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.code === "PROFANITY_DETECTED" ? "Please choose a different name." : typeof data.error === "string" ? data.error : "Couldn't send your color. Please try again.");
      if (controller.signal.aborted) return;
      fallbackCooldownEnd = Date.now() + 30_000;
      try { localStorage.setItem("rgboo_cooldown_end", new Date(fallbackCooldownEnd).toISOString()); } catch { /* Keep an in-memory cooldown. */ }
      const position = typeof data.queue_position === "number" ? data.queue_position : undefined;
      onResult({ kind: "success", position, message: position === undefined ? "Color sent! Watch the stream." : `Color sent! You're #${position} in the queue.` });
    } catch (error) {
      if (!controller.signal.aborted) onResult({ kind: "error", message: error instanceof Error ? error.message : "Couldn't connect. Please try again." });
    } finally { inFlight = false; }
  };
  return { send, destroy: () => controller.abort() };
}
