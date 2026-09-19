# Building the scene

The homepage now mounts a PixiJS v8 scene beside the existing color form. The
starter scene is deliberately just a screen and a placeholder housing. Replace
it with your own composition; no room or illustration style is baked in.

## Run locally

```sh
yarn install
yarn dev
```

If Yarn is not installed, use the project's pinned version through npm:

```sh
npx --yes --package=@yarnpkg/cli-dist@4.9.1 yarn dev
```

Copy `.env.example` to `.env.local` if you have not already done so. With
`VITE_DEV_EMBED=true`, development uses the existing `dev-assets/dev-embed.mp4`.
Restart Vite after changing environment variables. The local API is still
needed to actually submit colors; rendering the scene does not depend on it.

## Where to work

| File | Responsibility |
| --- | --- |
| `src/scene/scene.config.ts` | Design dimensions, screen opening, CRT settings, artwork manifest |
| `src/scene/createScene.ts` | Pixi containers, sprites, masks, animation, resize and cleanup |
| `src/scene/scene.css` | Browser layout and HTML controls |
| `src/media/createVideoPlayer.ts` | Native video/HLS playback and cleanup |
| `src/media/videoSource.ts` | Environment configuration |
| `src/components/StreamEmbed/StreamEmbed.tsx` | React lifecycle, playback controls, fallback |
| `src/layout/MainContent.tsx` | Homepage composition and existing color form |
| `public/scene/` | Your exported artwork |

## Add art

The scene uses a 1600 × 900 design space. Positions and sizes in the manifest
are design pixels. The whole scene scales uniformly to fit its container.
Mobile currently stacks the form below the scene; adjust the composition here
when your art direction calls for a dedicated portrait layout.

Export separate images with transparency where appropriate. Register them in
`sceneArtwork`, for example (these example files are not included):

```ts
export const sceneArtwork: SceneArtwork[] = [
  {
    id: "room",
    src: "/scene/room.webp",
    layer: "background",
    x: 0, y: 0, width: 1600, height: 900,
  },
  {
    id: "tv-bezel",
    src: "/scene/tv-bezel.png",
    layer: "foreground",
    x: 288, y: 148, width: 1024, height: 604,
  },
];
```

Draw order is `background → props → screen → foreground → lighting`.
Within a layer, manifest order is draw order. The TV screen lives in `screen`;
give bezel art a transparent opening and put it in `foreground`. Turn
`showPlaceholders` off when the actual housing is ready. Change `screen.x`,
`screen.y`, `screen.width`, `screen.height`, and `screen.radius` to match the art.
Video is contained inside that opening without stretching or cropping.

For animated or interactive objects, add code in `createScene.ts` using its
named `layers`. The starter world has `eventMode = "none"`; enable event handling
on the world and appropriate objects if you add Pixi pointer interactions.
Keep text inputs and essential controls in React so keyboard and touch input
remain native. Add animation to `app.ticker`; use `ticker.deltaMS` for elapsed
time rather than assuming a particular frame rate. Respect reduced motion.

CRT settings currently control scanlines, noise, and vignette. The filter's
`curvature` bends the scanlines, not the video geometry. Add a custom distortion
filter if the art needs a genuinely curved screen. Filters affect the display
container only. The user can disable effects, and reduced motion defaults them
off. Rendering pauses while the page is hidden.

## Connect direct video

```dotenv
VITE_DEV_EMBED=false
VITE_STREAM_URL=https://your-media-host.example/live/index.m3u8
VITE_STREAM_TYPE=hls
```

Use the actual browser playback URL, not an embed page or an RTMP ingest URL.
The scaffold supports HLS (native when available, otherwise lazy-loaded hls.js)
and browser-playable files such as MP4. `auto` recognizes `.m3u8` including query
strings; set `hls` explicitly for extensionless playback URLs. Codec support
still depends on the browser. WebRTC/signaling and ingest/transcoding are not
implemented; those belong in the media adapter or the streaming service.

Serve media over HTTPS in production. The media host must allow cross-origin
access from the site and development origin, including HLS manifests, segments,
and any encryption keys. Setting `crossOrigin` on the video alone is not enough.
Every `VITE_` value is public browser configuration; do not place secrets there.

Playback starts muted and exposes play/pause, mute, reconnect after errors, and
CRT toggling. Fatal HLS failures stop the transport until the visitor reconnects.
If WebGL initialization or artwork loading fails, a native video player is
shown. A missing production URL shows an offline state. The development clip
is never used as a production fallback. Configure Vite values at build time.

## Lifecycle and validation

React mounts the scene asynchronously and aborts it on unmount, including
StrictMode's development mount/cleanup cycle. The scene releases its canvas,
ticker, resize observer, video texture and filters. Artwork uses Pixi's shared
Assets cache, so it is retained between scene mounts; explicitly unload unused
art when implementing multiple large scenes.

```sh
yarn build
yarn test
yarn lint
```

Browser tests cover actual preview-video playback, the CRT control, StrictMode
cleanup and the existing form/admin behavior. Before connecting production,
also test your real stream on Safari and Chromium: codecs, CORS, latency and
reconnection depend on that media source.

References: [Pixi application lifecycle](https://pixijs.com/8.x/guides/components/application),
[Pixi textures](https://pixijs.com/8.x/guides/components/textures),
[CRT options](https://pixijs.io/filters/docs/CRTFilter.html),
[HLS.js](https://github.com/video-dev/hls.js).
