# 🕸️ web

Cloudflare workers deployed web app that allows someone to submit a color and name to the cloud API. The video stream will also be displayed on here.

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
- Embedded video stream viewer

## Technical Stack

- React with Vite build system
- Tailwind CSS for styling

## Deployment

Deployed using Cloudflare Workers.

```
yarn deploy
```

## API proxy

`worker/index.js` serves the app and proxies `/api/*` and `/admin-api/*` with
the Worker-to-API credential. Protect `/admin` and `/admin-api/*` with
Cloudflare Access; the admin browser never receives the key.

Which upstream it targets is the `API_UPSTREAM` var in `wrangler.jsonc` —
the Cloud Run service URL, authenticated with the `API_KEY` secret.

Secrets are never committed — upload them with wrangler:

```
wrangler secret put API_KEY
```

Protect `/admin` and `/admin-api/*` with the Cloudflare Access
application/policy.

Pointing the Worker at a different API is a config change, not a code
change:

```
# set API_UPSTREAM to the new Cloud Run URL in wrangler.jsonc
wrangler secret put API_KEY
wrangler deploy
```

See `docs/architecture.md` for how the pieces fit together.

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

Communicates with the cloud API to submit color requests and receive queue information including position and estimated wait times.
