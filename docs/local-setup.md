# Local development

`./scripts/dev.sh` runs a complete local RGBoo pipeline. It starts a Firestore
emulator, the Flask API, the bridge in safe dry-run mode, and Vite for the web
application. Every local process is forced to use the `rgboo-local` emulator
project at `127.0.0.1:8081`; it does not use application-default credentials
or the shared production Firestore project.

## First-time setup

Install Python 3.10+, Node.js 22+ (with Corepack), the Firebase CLI, and a JDK
supported by the Firebase Emulator Suite. Then run:

```bash
./scripts/setup.sh
./scripts/dev.sh
```

The first emulator boot may download the Firestore emulator. Keep the terminal
open while developing; Ctrl-C stops every process and saves emulator state in
`.firebase/` for the next run.

## Local URLs

| Service | URL | Purpose |
| --- | --- | --- |
| Web | http://127.0.0.1:5173 | Submit a colour request. |
| Admin | http://127.0.0.1:5173/admin | View/remove the local queue and clear the local overlay. |
| API | http://127.0.0.1:8080 | Direct API and Postman access. |
| Firestore Emulator UI | http://127.0.0.1:4000 | Inspect local `requests`, `meta`, and `denylist` documents. |
| Bridge OBS server | http://127.0.0.1:5077/obs | Local bridge overlay in dry-run mode. |

The web server proxies `/api/*` and `/admin-api/*` to the Flask API, attaching
the local API key on the server side just as the production Cloudflare Worker
does. That means both the visitor form and `/admin` exercise the same HTTP API
and the bridge observes the same Firestore request documents.

## Verify the flow

1. Open the web URL and submit a name and colour.
2. Watch the `[api]` log queue it and the `[bridge]` log dispatch it. The bridge
   is dry-run by default, so it logs the serial write instead of touching an
   ESP32.
3. Open `/admin` to see the queue and use its controls. Changes appear in the
   Firestore Emulator UI as well.

Requests retain the normal 20-second pacing. To attach real hardware, restart
with `./scripts/dev.sh --real-serial` after confirming the correct serial
device is available.

## Useful options

- `./scripts/dev.sh --api-only` starts the emulator and API only.
- `./scripts/dev.sh --bridge-only` starts the emulator and bridge only.
- `./scripts/dev.sh --no-web` omits Vite when using Postman or curl.

If the web port is occupied, set `RGBOO_WEB_PORT` before starting. The launcher
prints the resulting local URLs.

Delete `.firebase/` if you want a completely empty local Firestore database on
the next start. This only removes emulator state; it cannot affect production.
