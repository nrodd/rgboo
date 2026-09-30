/**
 * Now-playing pub/sub as a Durable Object.
 *
 * A plain Worker can't broadcast: the bridge's POST and the open SSE
 * connections may hit different isolates. A single DO instance owns every
 * connection, so a POST reaches all of them.
 *
 *   bridge  --POST /api/update-song-->  DO  --SSE-->  terminals + web UI
 *   bridge  --POST /api/update-color->  DO  --SSE-->  terminals + web UI
 *
 * The stream is Server-Sent Events, so the browser uses native EventSource and
 * the terminal uses `curl -N`. No client library either side.
 *
 * Two independent channels share one connection. The song stays the default
 * (unnamed) SSE event so existing subscribers are untouched; the color+username
 * currently on the LEDs rides a named `color` event alongside it. Each channel
 * keeps its own last value so a fresh listener gets both replayed at once.
 *
 * That last value is persisted to durable storage, not just held in memory: the
 * DO is evicted when idle, and the bridge only re-POSTs on a change, so an
 * in-memory-only value would leave a listener connecting to a cold DO blank
 * until the next song/color actually changes.
 */

const SSE_HEADERS = {
  "Content-Type": "text/event-stream",
  "Cache-Control": "no-cache",
  Connection: "keep-alive",
  // The web UI connects cross-origin via EventSource; curl doesn't care.
  "Access-Control-Allow-Origin": "https://rgboo.com",
};

/**
 * Wrap a payload as an SSE event, one `data:` prefix per line. Pass `event` to
 * emit a named channel; omit it for the default (unnamed) event the song uses.
 */
function sseEvent(text, event) {
  const body = String(text)
    .split("\n")
    .map((line) => `data: ${line}`)
    .join("\n");
  const prefix = event ? `event: ${event}\n` : "";
  return `${prefix}${body}\n\n`;
}

export class NowPlaying {
  constructor(state) {
    this.storage = state.storage;
    this.encoder = new TextEncoder();
    this.clients = new Set();
    // Last posted body per channel, replayed to new subscribers. Hydrate from
    // durable storage before serving any request so state survives eviction.
    this.currentSong = null;
    this.currentColor = null;
    state.blockConcurrencyWhile(async () => {
      this.currentSong = (await this.storage.get("song")) ?? null;
      this.currentColor = (await this.storage.get("color")) ?? null;
    });
  }

  async fetch(request) {
    if (request.method === "POST") {
      const { pathname } = new URL(request.url);
      return this.publish(pathname === "/api/update-color" ? "color" : "song", request);
    }
    return this.subscribe();
  }

  async publish(channel, request) {
    const body = await request.text();
    // The color channel is a named SSE event; the song stays the default one.
    if (channel === "color") {
      this.currentColor = body;
      await this.storage.put("color", body);
    } else {
      this.currentSong = body;
      await this.storage.put("song", body);
    }
    const chunk = this.encoder.encode(
      channel === "color" ? sseEvent(body, "color") : sseEvent(body),
    );
    for (const writer of this.clients) {
      // A dead connection rejects on write; drop it.
      writer.write(chunk).catch(() => this.clients.delete(writer));
    }
    return new Response("ok\n");
  }

  subscribe() {
    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();
    this.clients.add(writer);

    // Replay the current track and color immediately so a fresh listener isn't
    // blank until the next change; otherwise nudge proxies to flush the headers.
    let replay = "";
    if (this.currentSong) replay += sseEvent(this.currentSong);
    if (this.currentColor) replay += sseEvent(this.currentColor, "color");
    writer.write(this.encoder.encode(replay || ": connected\n\n"));

    // Heartbeat doubles as disconnect detection: a write to a closed stream
    // rejects, and that's when we clean up.
    const beat = setInterval(() => {
      writer.write(this.encoder.encode(": ping\n\n")).catch(() => {
        clearInterval(beat);
        this.clients.delete(writer);
      });
    }, 15000);

    return new Response(readable, { headers: SSE_HEADERS });
  }
}
