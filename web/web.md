# 🕸️ web

Cloudflare workers deployed web app that call allows someone to submit a color and name to the middleware. The twitch stream will also be displayed on here.

## Setup

- [node >=22](https://nodejs.org/en/download)
- [yarn](https://classic.yarnpkg.com/en/docs/install)

```
cd web
yarn
```

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

## API Integration

Communicates with the middleware API to submit color requests and receive queue information including position and estimated wait times.
