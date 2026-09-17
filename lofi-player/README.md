# lofi-player

Streams the [Lofi Girl](https://www.youtube.com/c/LofiGirl) YouTube channel to your
speakers. yt-dlp is bundled via npm; mpv is the one system dependency.

## Setup

```sh
brew install mpv   # or your platform's package manager
npm install
```

## Listen

```sh
npm start   # or: npx lofi
```

No prompts, no UI, just audio. Ctrl-C to stop.

As it plays, the current track is printed whenever it changes, fed by the rgboo
now-playing stream (`https://rgboo.com/api/stream`). Point elsewhere with
`RGBOO_STREAM_URL`. Same feed by hand:

```sh
curl -N https://rgboo.com/api/stream
```
