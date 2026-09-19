# Building the room

The homepage is a full-page PixiJS v8 scene based on the room sketch. The old
logo, form, info button and footer are no longer mounted; `/admin` is retained.
Everything in the room is placeholder geometry until your artwork is ready.

## Local preview

```sh
npm run dev
```

Open http://127.0.0.1:5173. Set `VITE_YOUTUBE_VIDEO_ID` in `.env.local` to the
current broadcast's video ID (currently `6LVM4iQfMX4`). Restart Vite after changing
configuration. A new YouTube broadcast can have a new ID. `/api/stream` provides
song metadata over SSE; it is not a video endpoint.

The official YouTube iframe sits over a matching rectangular opening in the
Pixi television. `src/scene/layout.ts` supplies the same coordinates to both
surfaces. On phones, the window scene sits above a larger TV. The player remains
at least 200 × 200; extremely small windows scroll instead of cropping it.

TV buttons and the volume slider use the official IFrame Player API. They are
accessible HTML controls in the TV casing, outside the video. The supported
`controls=0` option hides the native control bar. YouTube can still show its
branding, titles, ads and other player UI. We do not obscure or reskin those.
If API initialization fails, native YouTube controls are restored, with Retry
and a YouTube link available. Playback attempts to start muted; press Play if
browser autoplay is blocked. The stream remains usable if Pixi/artwork fails.

No YouTube media URLs are extracted or proxied. There are no CRT filters, masks,
or overlays over its player. The earlier direct-media adapter remains in
`src/media/createVideoPlayer.ts` for a future independently hosted source, but
is not connected to the homepage. Its old `VITE_STREAM_*`/`VITE_DEV_EMBED`
settings do not control this scene.

## Replace the placeholder art

Put transparent PNG/WebP exports in `public/scene/`. Set the matching `src`
inside `sceneArtwork` in `src/scene/scene.config.ts`, for example:

```ts
{ id: "frog", src: "/scene/frog.png", layer: "props",
  x: 1280, y: 565, width: 95, height: 70, action: "frog-hop" }
```

Slots are provided for wall, night sky, moon, two fog layers, window frame,
sill, frog, fixed spider, and two candles. Positions use a 1600 × 1000 design
space. Each export replaces only its own placeholder; a failed asset load keeps
the placeholder visible and logs the asset ID. Keep the frame transparent
between its bars. Fog and moon are clipped to the window opening. Fog drifts,
candles float, and the spider stays fixed. Reduced motion stops ambient movement
and the hop; the frog's API action still works. Rendering pauses in hidden tabs.

The TV has a separate `tvArtwork` entry because it resizes independently on
mobile. Default art bounds are 964 × 610.25 with an opening at (32, 32), sized
900 × 506.25. Update both the exported dimensions and `opening` when changing
the TV art. Keep the opening rectangular and clear, and leave space below it
for the controls. The iframe always remains fully visible above artwork.

`createScene.ts` owns Pixi containers, lifecycle and animation;
`placeholders.ts` contains only replaceable drawing code. Each slot can bind a
`SceneAction`. Media actions call the player adapter; room actions animate Pixi.
React owns the iframe, accessible TV controls and API feedback. Shared asset
textures remain cached across mounts, while each scene releases its canvas,
listeners, resize observer and ticker on unmount (including StrictMode).

## Frog interaction and API

Clicking the frog makes it hop and sends the same request as the old color form:

```http
POST /api/color
Content-Type: application/json

{"username":"Frog","color":{"r":143,"g":167,"b":123}}
```

The green is `#8FA77B`. Edit `src/api/frogColor.ts` to change the name/color.
The sender prevents overlapping requests and shares the form's 30-second
successful-send cooldown in localStorage. Every click can still animate the
frog. Feedback appears beneath the TV, including queue position, cooldown, or
a failed-send message. Failed requests do not start a cooldown.

With the canvas focused: Space plays/pauses, M toggles sound, F triggers the
frog and sends green, and L dims the candles. Clicking candles also dims them.

Production requests use the existing same-origin Worker route. Vite defaults
to the local API at `127.0.0.1:8080`; start the local backend from the repository
root with `./scripts/dev.sh --api-only` after completing its setup instructions.
The browser never receives the backend API key. The scene does not silently
redirect local development writes to production.

## Validation

```sh
npm run test
npm run build
npm run lint
```

Browser tests cover full-page layout, StrictMode cleanup, actual Pixi frog
clicks, the JSON payload, cooldown/error feedback, candle interactions, and
minimum player dimensions. YouTube API tests use a fake API to verify playback,
volume, autoplay-blocked state and cleanup without loading external media.
Live YouTube availability and embedding restrictions must also be checked in
a real browser. Retained form/admin/Worker tests run with the same suite.

References: [YouTube player parameters](https://developers.google.com/youtube/player_parameters),
[YouTube IFrame API](https://developers.google.com/youtube/iframe_api_reference),
[YouTube player requirements](https://developers.google.com/youtube/terms/required-minimum-functionality),
[Pixi events](https://pixijs.com/8.x/guides/components/events).

Optional live playback check (contacts YouTube; requires an active, embeddable
broadcast):

```sh
VITE_TEST_LIVE_YOUTUBE=6LVM4iQfMX4 npm run test -- src/__test__/youtube-live.test.tsx
```
