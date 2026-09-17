'use strict';

// Subscribe to the rgboo now-playing SSE stream and print each track change.
// The bridge pushes updates to the Cloudflare Worker; we just listen. This is
// best-effort: if the stream is unreachable, playback carries on regardless.
//
// Equivalent one-liner without this app: `curl -N https://rgboo.com/api/stream`

const STREAM_URL = process.env.RGBOO_STREAM_URL || 'https://rgboo.com/api/stream';

/** Format whatever the bridge posted -- JSON {artist,title} or plain text. */
function label(data) {
  try {
    const { artist, title } = JSON.parse(data);
    if (title) return artist ? `${artist} - ${title}` : title;
  } catch {
    // not JSON; fall through to the raw string
  }
  return data;
}

async function listen() {
  const res = await fetch(STREAM_URL, { headers: { Accept: 'text/event-stream' } });
  if (!res.ok || !res.body) return;

  const decoder = new TextDecoder();
  let buffer = '';
  for await (const chunk of res.body) {
    buffer += decoder.decode(chunk, { stream: true });
    // SSE events are separated by a blank line.
    let split;
    while ((split = buffer.indexOf('\n\n')) !== -1) {
      const event = buffer.slice(0, split);
      buffer = buffer.slice(split + 2);
      const data = event
        .split('\n')
        .filter((line) => line.startsWith('data:'))
        .map((line) => line.slice(5).trimStart())
        .join('\n');
      if (data) console.log(`♪ ${label(data)}`);
    }
  }
}

// Retry with a slow backoff so a dropped connection reconnects on its own.
async function start() {
  for (;;) {
    try {
      await listen();
    } catch {
      // ignore and reconnect
    }
    await new Promise((r) => setTimeout(r, 5000));
  }
}

module.exports = { start };
