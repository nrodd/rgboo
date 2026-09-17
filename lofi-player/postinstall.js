#!/usr/bin/env node
'use strict';

// Best-effort: make `mpv` available after `npm install` so listening works with
// zero manual setup. yt-dlp already arrives via the youtube-dl-exec dependency.
const { spawnSync } = require('child_process');

function has(cmd) {
  const probe = process.platform === 'win32' ? 'where' : 'which';
  return spawnSync(probe, [cmd], { stdio: 'ignore' }).status === 0;
}

function run(cmd, args) {
  console.log(`lofi-player: installing mpv via \`${cmd} ${args.join(' ')}\``);
  return spawnSync(cmd, args, { stdio: 'inherit' }).status === 0;
}

if (has('mpv')) {
  process.exit(0);
}

let installed = false;
switch (process.platform) {
  case 'darwin':
    if (has('brew')) installed = run('brew', ['install', 'mpv']);
    break;
  case 'linux':
    if (has('apt-get')) installed = run('sudo', ['apt-get', 'install', '-y', 'mpv']);
    else if (has('dnf')) installed = run('sudo', ['dnf', 'install', '-y', 'mpv']);
    else if (has('pacman')) installed = run('sudo', ['pacman', '-S', '--noconfirm', 'mpv']);
    break;
  case 'win32':
    if (has('winget')) installed = run('winget', ['install', '-e', '--id', 'mpv.mpv']);
    else if (has('choco')) installed = run('choco', ['install', 'mpv', '-y']);
    break;
}

if (!installed) {
  // Don't fail the install; just tell them how to finish the one manual step.
  console.warn('lofi-player: could not auto-install mpv. Install it manually, e.g. `brew install mpv`.');
}
