# 🕸️ web

Cloudflare workers deployed web app that call allows someone to submit a color and name to the middleware. The twitch stream will also be displayed on here.

## Setup

- [node >=22](https://nodejs.org/en/download)
- [yarn](https://classic.yarnpkg.com/en/docs/install)

```
cd web
yarn
```

Copy `.env.example` to `.env.local`.

## Features

- Color selection form with RGB picker
- Username input with profanity filtering
- Real-time queue position and wait time display
- Embedded Twitch stream viewer

## Technical Stack

- React with Vite build system
- Tailwind CSS for styling

## Deployment

Deployed using Cloudflare Workers.

```
yarn deploy
```

## API proxy

`worker/index.js` serves the app, proxies `/api/*`, and proxies the separate
`api-admin.rgboo.com` hostname with the Worker-to-API credential. Protect that
hostname with Cloudflare Access; the admin browser never receives the key.

Which upstream it targets is the `API_UPSTREAM` var in `wrangler.jsonc`:

| Upstream                     | Reached through          | Credentials                             |
| ---------------------------- | ------------------------ | --------------------------------------- |
| `https://api.rgboo.com`      | Cloudflare Tunnel + Access | `CF_ACCESS_ID` + `CF_ACCESS_SECRET`   |
| `https://<service>.run.app`  | Cloud Run (direct)       | `API_KEY`                               |

Secrets are never committed — upload them with wrangler:

```
wrangler secret put API_KEY
wrangler secret put CF_ACCESS_ID
wrangler secret put CF_ACCESS_SECRET
```

Protect `/admin` and the entire `api-admin.rgboo.com` hostname with the
Cloudflare Access application/policy.

The Worker sends whichever credentials are configured, so both sets can be
set at once during the migration: the old middleware ignores `X-Api-Key`,
and the Cloud Run API ignores the `CF-Access-*` headers. That makes the
cutover a config change rather than a code change:

```
# cut over to GCP: set API_UPSTREAM to the Cloud Run URL in wrangler.jsonc
wrangler secret put API_KEY
wrangler deploy

# roll back: set API_UPSTREAM back to https://api.rgboo.com
wrangler deploy
```

See `docs/gcp-migration-plan.md` for the full migration.

## Testing

Testing is powered through [Vitest](https://vitest.dev/) using [Playwright](https://playwright.dev/) for browser support. Can be run in headless mode (default) or in a browser. Server is mocked through [Mock Service Worker](https://mswjs.io/).

```
yarn test

yarn test:browser
```

Playwright might require you to install directly for testing browsers.

```
npx playwright install
```

## API Integration

Communicates with the middleware API to submit color requests and receive queue information including position and estimated wait times.
