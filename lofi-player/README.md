# lofi-player

Streams the [Lofi Girl](https://www.youtube.com/c/LofiGirl) YouTube channel to your
speakers. `npm install` pulls in both dependencies: yt-dlp (bundled via npm) and
mpv (installed on postinstall using your platform's package manager).

## Setup

```sh
npm install
```

The postinstall step installs mpv via brew / apt / dnf / pacman / winget / choco.
If none is available it prints a one-line hint so you can install mpv yourself.

## Listen

```sh
npm start   # or: npx lofi
```

No prompts, no UI, just audio. Ctrl-C to stop.
