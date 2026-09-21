'use strict';

// Subscribe to the rgboo now-playing SSE stream and draw a small live scene:
// a cat and jack-o-lantern glowing in the latest LED color, who requested it,
// and the current + previous track. The bridge pushes updates to the Cloudflare
// Worker; we just listen. Best-effort: if the stream is unreachable, playback
// carries on regardless.
//
// Equivalent one-liner without this app: `curl -N https://rgboo.com/api/stream`

const scene = require('./scene');

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

/** Pull {username, r, g, b} out of a color event, or null if it isn't one. */
function parseColor(data) {
  try {
    const { username, r, g, b } = JSON.parse(data);
    if ([r, g, b].every((v) => Number.isFinite(v))) {
      return { username: username || null, r, g, b };
    }
  } catch {
    // not JSON; not a color we can use
  }
  return null;
}

// Everything the scene draws. SSE events mutate this; the animation ticker
// advances `frame` and repaints, so nothing is ever logged line-by-line.
const state = { color: null, username: null, current: null, previous: null, frame: 0 };

const FPS = 8;

function draw() {
  // Home, then clear each line as we overwrite it and wipe anything below, so
  // the frame updates in place without the flicker of a full-screen clear.
  const lines = scene.render(state).split('\n');
  process.stdout.write('\x1b[H' + lines.map((l) => l + '\x1b[K').join('\n') + '\x1b[J');
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
        const color = parseColor(data);
        if (!color) continue;
        const { username, ...rgb } = color;
        state.color = rgb;
        state.username = username;
      } else {
        const track = label(data);
        // The worker replays the current track on connect; don't push a
        // duplicate into "previous" when nothing actually changed.
        if (track !== state.current) {
          state.previous = state.current;
          state.current = track;
        }
      }
      // The animation ticker paints the next frame; we just update state here.
    }
  }
}

// Restore the cursor whichever way we leave, so we never strand a hidden one.
function restoreCursor() {
  process.stdout.write('\x1b[?25h');
}

// Retry with a slow backoff so a dropped connection reconnects on its own.
async function start() {
  const streamUrl = resolveStreamUrl();
  process.stdout.write('\x1b[?25l\x1b[2J'); // hide cursor, clear the screen
  process.on('exit', restoreCursor);
  process.on('SIGINT', () => process.exit(0));

  // Drive the animation on its own timer, independent of when events arrive.
  const ticker = setInterval(() => {
    state.frame++;
    draw();
  }, 1000 / FPS);
  ticker.unref?.(); // don't keep the process alive just for the animation
  draw(); // show the first frame right away

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
