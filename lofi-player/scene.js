'use strict';

// The animated terminal scene: a witch bobbing along on her broom while the
// moon hangs overhead and trees drift past below. The witch is tinted with
// whatever color last came off the LEDs; everything else is fixed night-time
// palette. `render(state)` composites one frame and returns it as text; the
// caller owns the screen and drives `state.frame` forward on a timer.

const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';

// Halloween orange until a real color arrives, so the witch is never invisible.
const DEFAULT_COLOR = { r: 255, g: 138, b: 0 };

const W = 52; // canvas width
const SKY_H = 10; // rows of sky above the ground line
const GROUND_Y = SKY_H - 1;

function fg({ r, g, b }) {
  return `\x1b[38;2;${r};${g};${b}m`;
}

const MOON = fg({ r: 245, g: 232, b: 150 });
const STAR = fg({ r: 200, g: 200, b: 220 });
const TREE_NEAR = fg({ r: 40, g: 90, b: 55 });
const TREE_FAR = fg({ r: 30, g: 55, b: 45 });
const GROUND = fg({ r: 35, g: 30, b: 45 });

// --- sprites -----------------------------------------------------------------
// Space is transparent; every other glyph paints itself in the given color.

const MOON_ART = [
  '  _..',
  ' ( `.',
  ' |  |',
  ' ( .`',
  '  `-`'
];

// Witch facing right (direction of travel), broom trailing off to the left.
const WITCH = [
  '   __/|__',
  "   //'>",
  ',,_//\\____',
  "-' ) >",
  "   ''"
];

const TREE_NEAR_ART = [
  ' /\\ ',
  '/__\\',
  ' || '
];

const TREE_FAR_ART = [
  '/\\',
  '||'
];

// Fixed star field: [x, y, twinklePhase]. Positions are hand-placed so nothing
// collides with the moon; the phase staggers the twinkle so they don't blink
// in unison.
const STARS = [
  [3, 1, 0], [9, 3, 2], [14, 0, 1], [19, 4, 3], [24, 2, 0],
  [30, 1, 2], [8, 6, 1], [17, 7, 3], [2, 5, 2], [12, 2, 0],
  [26, 5, 1], [21, 1, 3]
];

// --- canvas ------------------------------------------------------------------

function blankCanvas() {
  const chars = [];
  const colors = [];
  for (let y = 0; y < SKY_H; y++) {
    chars.push(new Array(W).fill(' '));
    colors.push(new Array(W).fill(null));
  }
  return { chars, colors };
}

function place(canvas, sprite, x0, y0, color) {
  for (let j = 0; j < sprite.length; j++) {
    const y = y0 + j;
    if (y < 0 || y >= SKY_H) continue;
    const row = sprite[j];
    for (let i = 0; i < row.length; i++) {
      const ch = row[i];
      if (ch === ' ') continue; // transparent
      const x = x0 + i;
      if (x < 0 || x >= W) continue;
      canvas.chars[y][x] = ch;
      canvas.colors[y][x] = color;
    }
  }
}

// Serialize the grid into ANSI lines, coalescing runs of the same color so we
// emit one escape per run rather than per cell.
function serialize(canvas) {
  const lines = [];
  for (let y = 0; y < SKY_H; y++) {
    let line = '';
    let cur = null;
    for (let x = 0; x < W; x++) {
      const c = canvas.colors[y][x];
      if (c !== cur) {
        if (cur !== null) line += RESET;
        if (c !== null) line += c;
        cur = c;
      }
      line += canvas.chars[y][x];
    }
    if (cur !== null) line += RESET;
    lines.push(line);
  }
  return lines;
}

// A row of trees scrolling right-to-left. `speed` in columns/frame gives the
// parallax: near trees move faster than far ones.
function drawTreeLayer(canvas, art, color, spacing, speed, frame, offset) {
  const width = art[0].length;
  const period = W + spacing;
  const shift = Math.floor(frame * speed);
  for (let base = -spacing; base < W + spacing; base += spacing) {
    let x = (((base - shift + offset) % period) + period) % period - spacing;
    place(canvas, art, x, GROUND_Y - art.length + 1, color);
  }
}

// --- frame -------------------------------------------------------------------

/**
 * Build one frame from the current state:
 *   { color: {r,g,b}|null, username: string|null,
 *     current: string|null, previous: string|null, frame: number }
 */
function render(state = {}) {
  const color = state.color || DEFAULT_COLOR;
  const frame = state.frame || 0;
  const canvas = blankCanvas();

  // Stars (twinkle: skip a beat on their phase).
  for (const [x, y, phase] of STARS) {
    if ((frame + phase) % 7 === 0) continue;
    const bright = (frame + phase) % 3 === 0;
    place(canvas, [bright ? '+' : '.'], x, y, STAR);
  }

  // Moon, parked top-right.
  place(canvas, MOON_ART, W - 8, 0, MOON);

  // The ground line the trees stand on.
  place(canvas, [Array(W).fill('_').join('')], 0, GROUND_Y, GROUND);

  // Two tree layers for depth: far/slow/dim behind, near/fast in front.
  drawTreeLayer(canvas, TREE_FAR_ART, TREE_FAR, 11, 0.5, frame, 5);
  drawTreeLayer(canvas, TREE_NEAR_ART, TREE_NEAR, 17, 1, frame, 0);

  // Witch bobs gently as she flies, skimming the treetops. Drawn last so she
  // sits in front of the trees where their tops overlap her legs.
  const bob = [0, 0, -1, -1, 0, 0, 1, 1][frame % 8];
  place(canvas, WITCH, 6, 2 + bob, fg(color));

  const lines = serialize(canvas);

  // --- text below the scene --------------------------------------------------
  lines.push('');

  const swatch = `\x1b[48;2;${color.r};${color.g};${color.b}m  ${RESET}`;
  if (state.username) {
    const rgb = `rgb(${color.r}, ${color.g}, ${color.b})`;
    lines.push(`${swatch} ${BOLD}@${state.username}${RESET} ${DIM}${rgb}${RESET}`);
  } else if (state.color) {
    lines.push(`${swatch} ${DIM}rgb(${color.r}, ${color.g}, ${color.b})${RESET}`);
  } else {
    lines.push(`${swatch} ${DIM}waiting for a color...${RESET}`);
  }
  lines.push('');

  // Only ever the current track and the one before it.
  const now = state.current || '(nothing playing yet)';
  lines.push(`${fg(color)}♪${RESET} ${BOLD}${now}${RESET}`);
  lines.push(`${DIM}·  ${state.previous || '(none yet)'}${RESET}`);
  lines.push('');
  lines.push(`${DIM}Ctrl-C to stop${RESET}`);

  return lines.join('\n');
}

module.exports = { render, DEFAULT_COLOR };
