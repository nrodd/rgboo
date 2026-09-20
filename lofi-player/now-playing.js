'use strict';

// Subscribe to the rgboo now-playing SSE stream and print each track change.
// The bridge pushes updates to the Cloudflare Worker; we just listen. This is
// best-effort: if the stream is unreachable, playback carries on regardless.
//
// Equivalent one-liner without this app: `curl -N https://rgboo.com/api/stream`

const HOSTS = {
  prod: 'https://rgboo.com',
  staging: 'https://staging.rgboo.com'
};
const STREAM_PATH = '/api/stream';

/**
 * Work out which stream to hit. An explicit RGBOO_STREAM_URL wins (full URL);
 * otherwise `--staging`/`--prod` picks the host, defaulting to prod.
 */
function resolveStreamUrl(argv = process.argv.slice(2), env = process.env) {
  if (env.RGBOO_STREAM_URL) return env.RGBOO_STREAM_URL;
  const target = argv.includes('--staging') ? 'staging' : 'prod';
  return HOSTS[target] + STREAM_PATH;
}

/**
 * staging.rgboo.com is behind Cloudflare Access, so a bare request gets the
 * login page, not SSE. A service token (set both env vars) gets us through.
 */
function accessHeaders(env = process.env) {
  const id = env.CF_ACCESS_CLIENT_ID;
  const secret = env.CF_ACCESS_CLIENT_SECRET;
  if (id && secret) {
    return { 'CF-Access-Client-Id': id, 'CF-Access-Client-Secret': secret };
  }
  return {};
}

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

async function listen(streamUrl) {
  const res = await fetch(streamUrl, {
    headers: { Accept: 'text/event-stream', ...accessHeaders() }
  });

  if (!res.ok) {
    console.error(`now-playing: ${res.status} from ${streamUrl} (is the worker deployed here?)`);
    return;
  }
  // A redirect to an HTML page means Cloudflare Access bounced us to its login
  // instead of the stream -- set CF_ACCESS_CLIENT_ID/SECRET for staging.
  if ((res.headers.get('content-type') || '').includes('text/html')) {
    console.error('now-playing: got an HTML page, not SSE (Cloudflare Access login?). Set a service token for staging.');
    return;
  }
  if (!res.body) return;

  const decoder = new TextDecoder();
  let buffer = '';
  for await (const chunk of res.body) {
    buffer += decoder.decode(chunk, { stream: true });
    // SSE events are separated by a blank line.
    let split;
    while ((split = buffer.indexOf('\n\n')) !== -1) {
      const event = buffer.slice(0, split);
      buffer = buffer.slice(split + 2);
      const lines = event.split('\n');
      // The song is the default (unnamed) event; color rides a named `color`
      // event on the same stream. Route by name so one isn't shown as the other.
      const name = lines.find((line) => line.startsWith('event:'));
      const channel = name ? name.slice(6).trim() : 'message';
      const data = lines
        .filter((line) => line.startsWith('data:'))
        .map((line) => line.slice(5).trimStart())
        .join('\n');
      if (!data) continue;
      if (channel === 'color') {
        // Rendering the color/username on the terminal is the next step; for now
        // just surface that it arrived so the stream is verifiably wired up.
        console.log(`● ${data}`);
      } else {
        console.log(`♪ ${label(data)}`);
      }
    }
  }
}

// Retry with a slow backoff so a dropped connection reconnects on its own.
async function start() {
  const streamUrl = resolveStreamUrl();
  console.log(`now-playing: listening to ${streamUrl}`);
  for (;;) {
    try {
      await listen(streamUrl);
    } catch {
      // ignore and reconnect
    }
    await new Promise((r) => setTimeout(r, 5000));
  }
}

module.exports = { start, resolveStreamUrl };
