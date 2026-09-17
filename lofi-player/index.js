#!/usr/bin/env node
'use strict';

const { spawn } = require('child_process');
const path = require('path');

// Lofi Girl live radio. The /live endpoint points at the current broadcast;
// the plain channel URL (/c/LofiGirl) expands to a playlist of all uploads instead.
const STREAM_URL = 'https://www.youtube.com/@LofiGirl/live';

// yt-dlp binary shipped by youtube-dl-exec, so we don't rely on a system install.
const ytDlpPath = path.join(
  require.resolve('youtube-dl-exec/package.json'),
  '..',
  'bin',
  process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp'
);

console.log('lofi-player: now playing Lofi Girl. Ctrl-C to stop.');

const mpv = spawn(
  'mpv',
  [
    '--no-video',
    '--no-terminal',
    `--script-opts=ytdl_hook-ytdl_path=${ytDlpPath}`,
    STREAM_URL
  ],
  { stdio: 'inherit' }
);

mpv.on('error', (err) => {
  if (err.code === 'ENOENT') {
    console.error('mpv not found. Install it first (e.g. `brew install mpv`).');
  } else {
    console.error(err.message);
  }
  process.exit(1);
});

mpv.on('exit', (code) => process.exit(code ?? 0));
