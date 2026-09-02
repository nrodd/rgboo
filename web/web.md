# 🕸️ web

Cloudflare workers deployed web app that call allows someone to submit a color and name to the middleware. The video stream will also be displayed on here.

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
