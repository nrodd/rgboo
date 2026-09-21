'use strict';

// The little terminal scene: a cat next to a jack-o-lantern, both glowing in
// whatever color last came off the LEDs, plus who asked for it and the last two
// tracks. `render(state)` just returns the block of text; the caller owns the
// screen (clearing, cursor). Kept pure so it's easy to eyeball and test.

const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';

// Halloween orange until a real color arrives, so the scene never looks broken.
const DEFAULT_COLOR = { r: 255, g: 138, b: 0 };

// Cat and pumpkin are bottom-aligned; each row is a fixed width so the two
// figures line up when joined with a gap. Backslashes are doubled for JS.
const CAT = [
  '        ',
  '  /\\_/\\ ',
  ' ( o.o )',
  '  > ^ < ',
  ' (_)(_) '
];

const PUMPKIN = [
  '    ,    ',
  '  _____  ',
  ' /^   ^\\ ',
  '|  \\_/  |',
  ' \\_____/ '
];

const GAP = '    ';
const INDENT = '  ';

function fg({ r, g, b }) {
  return `\x1b[38;2;${r};${g};${b}m`;
}

/** The cat + pumpkin figures, every line painted in `color`. */
function art(color) {
  const paint = fg(color);
  return CAT.map((catRow, i) => `${INDENT}${paint}${catRow}${GAP}${PUMPKIN[i]}${RESET}`);
}

/**
 * Build the whole scene from the current state:
 *   { color: {r,g,b}|null, username: string|null,
 *     current: string|null, previous: string|null }
 */
function render(state = {}) {
  const color = state.color || DEFAULT_COLOR;
  const lines = [];

  lines.push('');
  lines.push(`${INDENT}${BOLD}rgboo${RESET}${DIM}  ·  now playing${RESET}`);
  lines.push('');
  lines.push(...art(color));
  lines.push('');

  // Who owns the current color.
  const swatch = `\x1b[48;2;${color.r};${color.g};${color.b}m  ${RESET}`;
  if (state.username) {
    const rgb = `rgb(${color.r}, ${color.g}, ${color.b})`;
    lines.push(`${INDENT}${swatch} ${BOLD}@${state.username}${RESET} ${DIM}${rgb}${RESET}`);
  } else if (state.color) {
    lines.push(`${INDENT}${swatch} ${DIM}rgb(${color.r}, ${color.g}, ${color.b})${RESET}`);
  } else {
    lines.push(`${INDENT}${swatch} ${DIM}waiting for a color...${RESET}`);
  }
  lines.push('');

  // Only ever the current track and the one before it.
  const now = state.current || '(nothing playing yet)';
  lines.push(`${INDENT}${fg(color)}♪${RESET} ${BOLD}${now}${RESET}`);
  lines.push(`${INDENT}${DIM}·  ${state.previous || '(none yet)'}${RESET}`);
  lines.push('');
  lines.push(`${INDENT}${DIM}Ctrl-C to stop${RESET}`);
  lines.push('');

  return lines.join('\n');
}

module.exports = { render, DEFAULT_COLOR };
