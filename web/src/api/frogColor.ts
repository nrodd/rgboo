export const frogColor = { username: "Frog", color: { r: 143, g: 167, b: 123 } };
const cooldownKey = "rgboo_cooldown_end";

/** One in-flight submission; share the original form's successful-send cooldown. */
export function createFrogSender(onMessage: (message: string) => void) {
  let pending = false;
  let memoryCooldownEnd = 0;
  const controller = new AbortController();
  const send = async () => {
    if (pending || controller.signal.aborted) return;
    let cooldownEnd = 0;
    try { cooldownEnd = Date.parse(localStorage.getItem(cooldownKey) ?? "") || 0; } catch { /* Storage may be disabled. */ }
    cooldownEnd = Math.max(cooldownEnd, memoryCooldownEnd);
    if (cooldownEnd > Date.now()) {
      onMessage(`Frog is resting. Try again in ${Math.ceil((cooldownEnd - Date.now()) / 1000)}s.`);
      return;
    }
    pending = true;
    onMessage("Frog is sending green…");
    try {
      const response = await fetch("/api/color", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(frogColor), signal: controller.signal,
      });
      if (!response.ok) throw new Error("Color submission failed");
      const data: { queue_position?: number } = await response.json();
      if (controller.signal.aborted) return;
      memoryCooldownEnd = Date.now() + 30_000;
      try { localStorage.setItem(cooldownKey, new Date(memoryCooldownEnd).toISOString()); } catch { /* Keep playback usable without storage. */ }
      onMessage(typeof data.queue_position === "number" ? `Frog sent green! #${data.queue_position} in the queue.` : "Frog sent green!");
    } catch {
      if (!controller.signal.aborted) onMessage("Frog couldn't send green. Try again in a moment.");
    } finally { pending = false; }
  };
  return { send, destroy: () => controller.abort() };
}
