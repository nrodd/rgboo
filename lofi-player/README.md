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
now-playing stream (`https://rgboo.com/api/stream`). Same feed by hand:

```sh
curl -N https://rgboo.com/api/stream
```

## Staging vs production

Production is the default. To listen to the staging Durable Object
(`https://staging.rgboo.com/api/stream`) instead, pass `--staging`:

```sh
npm start -- --staging   # or: npm run start:staging  /  npx lofi --staging
```

For anything else (a preview deploy, local worker), set a full URL with
`RGBOO_STREAM_URL`, which overrides the flag.
