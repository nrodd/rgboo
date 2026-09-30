# Building the room

The homepage is a full-page PixiJS v8 scene based on the room sketch. The old
logo, form, info button and footer are no longer mounted; `/admin` is retained.
The room integrates the PNG exports from `feat/pixel-art`, including animated
characters, weather, flames and tape hover states. Unexported props retain their
code-authored placeholders.
The CRT has a stepped plastic casing, rabbit-ear antenna and feet on a wooden
stand. Four VHS tapes sit on the shelf below it. Hovering or focusing a tape
adds a subtle pixel halo. The Submit tape sends the current color draft, opening the form to complete missing fields. The first three open compact shadcn glass cards on the right: color submission, project links, and settings.

## Local preview

```sh
npm run dev
```

Open http://127.0.0.1:5173. The channel ID is hardcoded in
`src/components/StreamEmbed/StreamEmbed.tsx`, so the player follows each new
broadcast without environment configuration. `/api/stream` provides song
metadata over SSE; it is not a video endpoint.

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

No YouTube media URLs are extracted or proxied. The requested rounded corner mask reveals the TV bezel; no CRT filters
are applied to playback. The earlier direct-media adapter remains in
`src/media/createVideoPlayer.ts` for a future independently hosted source, but
is not connected to the homepage. Its old `VITE_STREAM_*`/`VITE_DEV_EMBED`
settings do not control this scene.

## Replace the placeholder art

Put transparent PNG/WebP exports in `public/scene/`. Set the matching `src`
inside `sceneArtwork` in `src/scene/scene.config.ts`, for example:

```ts
{ id: "frog", src: "/scene/frog.webp", layer: "props",
  x: 1280, y: 565, width: 95, height: 70, action: "frog-hop" }
```

Slots are provided for wall, night sky, moon, two fog layers, window frame,
frog, fixed spider, and two candles. The custom window includes its own sill. Positions use a 1600 × 1000 design
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
mobile. The full TV export is 255 × 209 with an opening at (13, 9), sized
229 × 130. Update both the exported dimensions and `opening` when changing
the TV art. Keep the opening rectangular and clear, and leave space below it
for the walnut fascia. The iframe sits above artwork with a small corner mask matching the bezel.

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

{"username":"Frog","color":{"r":0,"g":255,"b":0}}
```

The frog sends saturated green, `#00FF00`. Edit `src/api/frogColor.ts` to change the name/color.
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
VITE_TEST_LIVE_YOUTUBE=6LVM4iQfMX4 npm run test:live
```


## Room ambience and animal behavior

`characters.ts` loads `src/assets/cat_default.webp` (96 × 96 resting pose) and
`cat_awake.webp` (64 × 64 awake pose). The cat breathes gently, occasionally
opens its eyes and blinks while awake. The decoded pixels and palette
are unchanged; Pixi crops their transparent padding and normalizes pose widths.
The resting body ends at source row 64; the awake body ends at row 43. Both
share the same TV contact plane, with the tail below that plane kept stationary
while the body breathes upward. Its scale adapts to the space above the TV.
The frog rests outside behind the rain and window frame. A half-second tick
holds `asleep_0` for six ticks and `asleep_1` for two ticks. Every 47 seconds
it wakes for eight seconds, cycling its four awake frames at one second each.
These idle behaviors never call the API. Clicking the frog still performs its
larger hop and the existing green submission with cooldown protection.

`src/assets/window.webp` supplies the frame, reflections and sill as one square
export. `windowOpening` clips rain, moon and fog to its panes. The frog and mug align with the integrated sill. Curtains and the curtain rod
are removed so the custom frame stays visible. Wallpaper is slightly lighter
for contrast behind the dark cat; the cat artwork itself is not brightened.

`atmosphere.ts` adds two depths of pixel rain within the outside-window mask,
a shared warm candlelight pool, and cool TV light on the wall, bezel and shelf.
The candles use `src/assets/candle_fat.webp` and `candle_tall.webp`. Their `crop`
bounds in `scene.config.ts` remove transparent margins, and they scale uniformly.
These exports contain wax only, so separate pixel flames sit above the wicks.
The candles sit closer together next to the TV, float slightly and still dim
when clicked (or with L).
`sceneConfig.ambience.color` sets the TV light color (a cool blue chosen to
match the current broadcast). This is authored lighting, not live color sampling
from YouTube. Its intensity follows the official player's play/pause state.
The video opening has a scaled corner mask to reveal the frame; lighting and
other props do not cover the playback surface.

Reduced motion holds rain and animals still and removes light flicker; playback
brightness changes remain available. Hidden tabs pause rendering, and all
animation uses the existing scene ticker and cleanup lifecycle.

The current styling leans toward a cozy late-80s/early-90s living room: muted
plum wallpaper, walnut paneling, a teal woven rug and TV runner,
a mug on the sill, and faded striped VHS labels. `roomDecor.ts` draws the rug;
the mug export has a named slot in `sceneArtwork`.

Cat breathing scales gently upward around its local y=0 resting plane rather
than translating the sprite. Its paws remain in contact with the TV runner;
a regression test checks that contact across a complete animation cycle.


The receiver palette uses dark walnut and a nearly black inner bezel. Room colors and fabric highlights
are subdued to sit closer to the dark live broadcast. A vignette is applied
only over the Pixi scene; the official iframe remains above it with its corner mask matching the TV frame.
The settings panel uses a warm brass shadcn slider with keyboard and touch support.


The TV and stand are raised together, with a wider, deeper rug underneath.
VHS tapes are upright sleeves with the upright tape bases aligned to the shelf.
`layout.ts` now owns tape, rug and cat placements as well as the screen.
The cat and its woven runner sit on the TV's right edge in front of the window
frame on desktop; the tail can extend slightly beyond the casing while the
body remains supported. Mobile keeps the cat inside the viewport and puts candles on the rug,
clear of the logo and interactive tape gaps. The old
receiver badge and control strip have been removed.

## VHS panels and resizing

`ScenePanels.tsx` owns the color form, existing Twitch/GitHub/YouTube links, and
playback/accessibility settings. Cards float on the right with content-sized
height, a neutral translucent tint, native backdrop diffusion and a reflective
lens rim. `glassMaterial.ts` supplies a displacement map with a neutral centre
and inward displacement at the edges, replacing the earlier noise ripple.
The edge effect is separate from the native blur and does not distort controls. High-contrast and reduced-transparency modes use an opaque surface. They use
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
Opening focuses the card rather than the close button; Tab moves to the close
button with a visible keyboard focus outline.

Resize observers keep the HTML player, tape hit areas and Pixi geometry aligned
without replacing the iframe or canvas. Pixi immediately renders after resizing
and preserves its drawing buffer, avoiding a cleared frame while native window
resizing suspends animation frames. Portrait layouts put the window above the TV
and candles on the rug. Short viewports scroll to preserve
YouTube's 200 × 200 minimum player. Browser tests sample rendered pixels through
repeated resizes and exercise the panels with mocked color submissions.

The Halloween palette uses ink/plum walls, faded teal fabric
and warm amber light. Pixel paper bats hang above the TV, a cobweb sits in the
upper corner, bare branches sit behind the rain, and a jack-o'-lantern lights
the floor beside the stand. On narrow screens the pumpkin moves onto the rug
below the tapes. Its `pumpkin` artwork slot accepts a custom sprite export.

## Integrated pixel-art exports

The scene now uses lossless WebP versions of every PNG export from `feat/pixel-art`, including the
frog poses, rain and fog sequences, pink and green candle flames, TV casing,
and color/info/name/submit VHS artwork with hover frames. `artAssets.ts` resolves
the original exports; scene animation uses the existing ticker and stops with
reduced motion. Existing tape actions and keyboard controls are retained.
One horizontal Submit tape sits in the widest shelf gap; its action remains a
color submission action.

The full TV export includes its original shelf and preset books.
`tapeArtworkSlots` places the larger interactive tapes in the gaps between those
books using the same source-to-screen transform as the TV.
Its player opening is at (13, 9), sized 229 × 130 source pixels; the iframe
uses the shared screen bounds and uses a small corner mask to reveal the TV artwork beneath.

## Application logo

`BrandLogo` renders the supplied `rgboo-logo.webp` and registers `logo-eyes.svg`
over its eyes. A rendering filter removes the PNG's black background; the
decoded source pixels remain intact. The pupils ease toward the pointer with
bounded movement and return to rest when the pointer leaves the window.
System and scene reduced-motion settings hold them still. Listener and
animation cleanup supports StrictMode and route changes.

The logo now shares the TV's resize geometry. Its lower text edge is masked to
meet the casing while the ghost extends over the rim; the entire logo stays
above the video opening. Pupils converge independently toward nearby pointers
and respond in both axes with faster easing. The window and its weather, frog,
and mug are shifted together upward and to the right.

The cross-origin YouTube player owns pointer events inside the video. Eye
tracking holds its last position there and resumes over the surrounding page.

On narrow screens the candles move onto the rug and the ambient ghost moves
below the shelf on the right. The logo's text and ghost use separate masks:
the letters shift down to sit flush on the casing, while the ghost retains its
original position over the rim. The CRT underline under the letters is masked
out to remove the floating gap.

The logo is horizontally centered on the TV. Color occupies the middle
book gap, Setup the next gap, and Info sits directly beside Submit in the
widest gap. A click on
another tape while a card is open routes through the modal backdrop to swap
its content immediately, retaining the color draft and keyboard focus handling.

On phones, panels fill the screen with Color, Links and Settings navigation.
They scroll inside the available height and close with the close button.
Desktop tape clicks swap panels; clicking the same tape again closes its panel.

The Settings tape keeps the original name-tape colors and hover frames, with
a source-pixel `SETUP` label drawn over its old lettering. The replacement
letters share the eight-frame orange highlight sweep on hover and keyboard
focus, and hold still with reduced motion.

## Raster asset delivery

All room sprites and the logo use lossless WebP, with exact RGBA round-trip
verification against their original PNGs (399,688 → 245,008 bytes). Nearest-neighbor
sampling remains unchanged. Vite emits separate hashed assets instead of inlining
frames into JavaScript, allowing browser caching without inflating the scene bundle.

## Shared pre-push tests

Run `corepack yarn install` in `web/` after cloning. The postinstall script
configures this checkout to use the versioned `.githooks/pre-push` hook. Every
push runs the web unit/browser suite and is blocked if it fails. Install the
browser once with `corepack yarn playwright install chromium` (on Linux, use
`corepack yarn playwright install --with-deps chromium`). CI skips hook setup.

The normal suite uses a local test-stream iframe and a fake YouTube API, so it
never loads the production broadcast or YouTube scripts. Adapter URL tests use
detached iframes. The explicitly opted-in live check remains separate and is
excluded from the pre-push hook. Production and local app previews keep the
hardcoded channel; the test fixture is only loaded by Vitest.

The cat contact plane follows the TV artwork's scale rather than a fixed offset.
The ghost mask excludes the source logo underline so no colored stripe remains.
The room redraws at 30fps and at 10fps behind open controls to keep interactions
responsive on software rendering and low-power devices.

Panel interaction unit tests use a static canvas fixture. Actual WebGL coverage
remains for scene resizes, preference updates, lifecycle and frog interactions.

The YouTube adapter uses the official privacy-enhanced embed domain and muted
autoplay. A transient HTML5 player error retries once; manual Retry creates a
fresh iframe without recreating the scene. Stale player events and retry timers
are discarded on reconnect or unmount. Embedding/permission errors do not loop.
Privacy-enhanced embedding may reduce session-related problems but cannot fix
extensions blocking playback or restrictions imposed by YouTube.
Reference: https://support.google.com/youtube/answer/171780
