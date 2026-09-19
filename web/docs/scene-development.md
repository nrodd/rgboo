# Building the room

The homepage is a full-page PixiJS v8 scene based on the room sketch. The old
logo, form, info button and footer are no longer mounted; `/admin` is retained.
The room uses code-authored pixel-art placeholders until your artwork is ready.
The CRT has a stepped plastic casing, rabbit-ear antenna and feet on a wooden
stand. Five VHS tapes sit on the shelf below it. Hovering or focusing a tape
adds a subtle pixel halo. The last two tapes show a temporary “Coming soon” toast. The first three open compact shadcn glass cards on the right: color submission, project links, and settings.

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

The TV fascia has no visible toolbar or receiver branding. Playback, mute and
volume controls live in the third tape's settings panel and use the official
IFrame Player API. The supported `controls=0` option hides the native control
bar; YouTube can still show its own branding, titles, ads and other UI. If API
initialization fails, native controls are restored. Settings includes a reconnect
action, and the links panel includes the YouTube watch link. Playback starts
muted; use Settings or the canvas Space/M shortcuts to start playback or sound.

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
space (the wall fills the viewport independently). Each export replaces only its own placeholder; a failed asset load keeps
the placeholder visible and logs the asset ID. Keep the frame transparent
between its bars. Fog and moon are clipped to the window opening. Fog drifts,
candles float, and the spider stays fixed. Reduced motion stops ambient movement
and the hop; the frog's API action still works. Rendering pauses in hidden tabs.

Pixel sprites use nearest-neighbor sampling and the canvas disables
antialiasing. `pixelArt.ts` provides small sprite-grid drawing helpers;
`television.ts` draws the CRT, stand and cassettes. VHS colors and labels live
in `vhsTapes` in the scene config. Their transparent HTML hit targets match
Pixi coordinates and supply keyboard focus; the glow itself is rendered in Pixi.

The TV has a separate `tvArtwork` entry because it resizes independently on
mobile. Default art bounds are 964 × 610.25 with an opening at (32, 32), sized
900 × 506.25. Update both the exported dimensions and `opening` when changing
the TV art. Keep the opening rectangular and clear, and leave space below it
for the walnut fascia. The iframe always remains fully visible above artwork.

`createScene.ts` owns Pixi containers, lifecycle and animation;
`placeholders.ts` contains only replaceable drawing code. Each slot can bind a
`SceneAction`. Media actions call the player adapter; room actions animate Pixi.
React owns the iframe, accessible VHS panels and API feedback. Shared asset
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
frog. A short toast reports a successful submission or failure. Cooldown hops
are silent; there is no “frog is resting” text. Failed requests do not start a cooldown.

With the canvas focused: Space plays/pauses, M toggles sound, F triggers the
frog and sends green, and L dims the candles. Clicking candles also dims them.

Production requests use the existing same-origin Worker route. Vite defaults
to the local API at `127.0.0.1:8080`; start the local backend from the repository
root with `./scripts/dev.sh --api-only` after completing its setup instructions.
The browser never receives the backend API key. To explicitly test scene actions against the live stream, set
`RGBOO_PUBLIC_API_URL=https://rgboo.com` in `.env.development.local` and restart
Vite. This routes public API calls through the existing deployed Worker without
putting backend credentials in the browser. Admin calls still target the local
backend. Leave the setting empty to use the local backend for everything.

## Validation

```sh
npm run test
npm run build
npm run lint
```

Browser tests cover full-page layout, StrictMode cleanup, actual Pixi frog
clicks, the JSON payload, cooldown/error feedback, candle interactions, VHS hover/focus/click interactions and toast dismissal, and
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


## Room ambience and animal behavior

`characters.ts` draws a lounging pixel cat on the TV, with slow breathing,
sleepy blinks, an occasional ear twitch and a lazy tail. The frog blinks,
breathes, looks toward the rain, and makes a small idle hop every 14 seconds.
These idle behaviors never call the API. Clicking the frog still performs its
larger hop and the existing green submission with cooldown protection.

`atmosphere.ts` adds two depths of pixel rain within the outside-window mask,
a shared warm candlelight pool, and cool TV light on the wall, bezel and shelf.
The candles sit closer together next to the TV and float only slightly.
`sceneConfig.ambience.color` sets the TV light color (a cool blue chosen to
match the current broadcast). This is authored lighting, not live color sampling
from YouTube. Its intensity follows the official player's play/pause state.
The video opening stays clear: no overlays, masks or filters cover the iframe.

Reduced motion holds rain and animals still and removes light flicker; playback
brightness changes remain available. Hidden tabs pause rendering, and all
animation uses the existing scene ticker and cleanup lifecycle.

The current styling leans toward a cozy late-80s/early-90s living room: muted
plum wallpaper, walnut paneling, rose curtains, a teal woven rug and TV runner,
a mug on the sill, and faded striped VHS labels. `roomDecor.ts` draws the rug;
the curtain and mug exports have named slots in `sceneArtwork`.

Cat breathing scales gently upward around its local y=0 resting plane rather
than translating the sprite. Its paws remain in contact with the TV runner;
a regression test checks that contact across a complete animation cycle.


The receiver palette uses dark walnut and a nearly black inner bezel. Room colors and fabric highlights
are subdued to sit closer to the dark live broadcast. A vignette is applied
only over the Pixi scene; the official iframe remains above it and unobstructed.
The settings panel uses a warm brass shadcn slider with keyboard and touch support.


The TV and stand are raised together, with a wider, deeper rug underneath.
VHS tapes are upright sleeves with all five bases aligned to the shelf.
`layout.ts` now owns tape, rug and cat placements as well as the screen.
The cat and its woven runner sit on the TV's right edge in front of the window
frame on desktop; the tail can extend slightly beyond the casing while the
body remains supported. Mobile keeps the cat inside the viewport. The old
receiver badge and control strip have been removed.

## VHS panels and resizing

`ScenePanels.tsx` owns the color form, existing Twitch/GitHub/YouTube links, and
playback/accessibility settings. Cards float on the right with content-sized
height, subtle backdrop blur, a thin highlight and rounded corners. They use
short labels without descriptive captions. The color picker has a compact
saturation field, slim hue bar, preset swatches and an integrated hex field. Components in
`src/components/ui` come from the official shadcn New York registry and are
locally themed in `scene.css`; `components.json` configures future additions.
Source: https://ui.shadcn.com/docs/components/radix/sheet

The custom form validates the existing name/RGB schema and sends `/api/color`.
`colorSubmission.ts` shares one in-flight guard and a 30-second successful-send
cooldown with the frog. Requests are aborted on unmount; failures can be retried.
Reduced motion, higher UI contrast and visible tape labels persist locally.
Device reduced-motion preferences are always respected. Sheets trap keyboard
focus, close with Escape, and restore focus to the tape that opened them.

Resize observers keep the HTML player, tape hit areas and Pixi geometry aligned
without replacing the iframe or canvas. Pixi immediately renders after resizing
and preserves its drawing buffer, avoiding a cleared frame while native window
resizing suspends animation frames. Portrait layouts put the window above the TV
and candles at the free end of the shelf. Short viewports scroll to preserve
YouTube's 200 × 200 minimum player. Browser tests sample rendered pixels through
repeated resizes and exercise the panels with mocked color submissions.
