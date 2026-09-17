/**
 * Now-playing pub/sub as a Durable Object.
 *
 * A plain Worker can't broadcast: the bridge's POST and the open SSE
 * connections may hit different isolates. A single DO instance owns every
 * connection, so a POST reaches all of them.
 *
 *   bridge  --POST /api/update-song-->  DO  --SSE-->  terminals + web UI
 *
 * The stream is Server-Sent Events, so the browser uses native EventSource and
 * the terminal uses `curl -N`. No client library either side.
 */

const SSE_HEADERS = {
  "Content-Type": "text/event-stream",
  "Cache-Control": "no-cache",
  Connection: "keep-alive",
  // The web UI connects cross-origin via EventSource; curl doesn't care.
  "Access-Control-Allow-Origin": "https://rgboo.com",
};

/** Wrap a payload as an SSE `data:` event, one prefix per line. */
function sseEvent(text) {
  const body = String(text)
    .split("\n")
    .map((line) => `data: ${line}`)
    .join("\n");
  return `${body}\n\n`;
}

export class NowPlaying {
  constructor() {
    this.encoder = new TextEncoder();
    this.clients = new Set();
    this.current = null; // last posted body, replayed to new subscribers
  }

  async fetch(request) {
    if (request.method === "POST") {
      return this.publish(request);
    }
    return this.subscribe();
  }

  async publish(request) {
    this.current = await request.text();
    const chunk = this.encoder.encode(sseEvent(this.current));
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

    // Replay the current track immediately so a fresh listener isn't blank
    // until the next change; otherwise nudge proxies to flush the headers.
    writer.write(this.encoder.encode(this.current ? sseEvent(this.current) : ": connected\n\n"));

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
