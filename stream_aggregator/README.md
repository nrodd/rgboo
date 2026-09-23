# Stream aggregator

Python 3.10+ worker that receives YouTube and Twitch chat concurrently and submits
color commands to RGBoo's existing `cloud_api/` service. No inbound port is needed.
Run **one instance** for each configured stream pair to avoid duplicate submissions.

Accepted whole-message commands (case insensitive, outer whitespace allowed):
`!red`, `!blue`, `!teal`, CSS3 color names plus `!rebeccapurple`, `!#ff00aa`,
`!ff00aa`, `!#f0a`, and `!f0a`. Alpha colors, extra words, and other chat are ignored.
Names use standard CSS values (for example, `green` is `#008000`; `lime` is `#00ff00`).

The worker sends `POST {CLOUD_API_URL}/api/color` with `X-Api-Key: CLOUD_API_KEY`:

```json
{"username":"ViewerName","color":{"r":0,"g":128,"b":128}}
```

Display names are preserved, so existing cloud moderation and overlay behavior
apply. Platform/message IDs are used locally for duplicate suppression. The cloud
API remains responsible for scheduling colors and forwarding them to the bridge.

## Docker deployment

From the repository root:

```sh
cp stream_aggregator/.env.example stream_aggregator/.env
# Fill in the cloud credentials and at least one platform's configuration.
docker compose -f stream_aggregator/compose.yaml up --build -d
docker compose -f stream_aggregator/compose.yaml logs -f
```

Or build/run directly (the build context is the new folder):

```sh
docker build -t rgboo-stream-aggregator stream_aggregator
docker run -d --name rgboo-stream-aggregator --restart unless-stopped \
  --init --stop-timeout 30 --env-file stream_aggregator/.env \
  -v rgboo-stream-tokens:/data rgboo-stream-aggregator
```

Set `CLOUD_API_URL` to the API **base URL**, without `/api/color`, and
`CLOUD_API_KEY` to its existing API key. The example points to the deployed API;
use a local API URL and local key for development. Inside Docker, a host API can
be reached at `http://host.docker.internal:8080` on Docker Desktop.

The image runs as non-root (UID 10001). The named volume stores rotated Twitch
credentials; a bind mount instead must be writable by this UID. Secrets are never
copied into the image. Do not commit `.env` or token files.

Deploy to an always-running container host/VM with outbound HTTPS/WebSocket
access. This is a background worker, not a request-serving Cloud Run service;
request-based CPU and scale-to-zero would stop chat ingestion. Logs go to stdout.

## Unraid deployment

The Dockerfile should work on Unraid without application changes, but has not
been tested on an Unraid machine. There is no published image or Community Apps
template yet; build the image locally from a copy of this repository.

Unraid does not include native Docker Compose support. Use the terminal commands
below, configure the built image through **Docker → Add Container**, or install
Compose support separately. See the [Unraid Docker documentation](https://docs.unraid.net/unraid-os/using-unraid-to/run-docker-containers/overview/).

From the repository root in the Unraid terminal:

```sh
docker build -t rgboo-stream-aggregator stream_aggregator
cp stream_aggregator/.env.example stream_aggregator/.env
# Edit stream_aggregator/.env with your cloud and platform credentials.

mkdir -p /mnt/user/appdata/stream-aggregator
chown 10001:10001 /mnt/user/appdata/stream-aggregator
chmod 700 /mnt/user/appdata/stream-aggregator

docker run -d --name rgboo-stream-aggregator --restart unless-stopped \
  --network bridge --init --stop-timeout 30 \
  --env-file stream_aggregator/.env \
  -v /mnt/user/appdata/stream-aggregator:/data \
  rgboo-stream-aggregator
```

The `/data` mapping preserves refreshed Twitch credentials in Unraid's appdata
share. The container runs as UID/GID `10001:10001`, so this directory must be
writable by that identity. Keep `TWITCH_TOKEN_FILE=/data/twitch-tokens.json` when
using automatic refresh. No inbound port mappings or privileged access are needed;
the container only makes outbound connections.

If using **Add Container** instead of `docker run`, use these settings after
building the image:

| Setting | Value |
| --- | --- |
| Name | `rgboo-stream-aggregator` |
| Repository/image | `rgboo-stream-aggregator:latest` (locally built) |
| Network type | `Bridge` |
| Host path → container path | `/mnt/user/appdata/stream-aggregator` → `/data` (read/write) |
| Variables | Cloud and platform variables from `.env.example` |
| Extra Parameters (Advanced View) | `--init --stop-timeout 30` |
| Privileged | Off |
| Port mappings | None |

Enable **Autostart** in Unraid for the UI-managed container. Choose either the
terminal or UI method to create the container, not both. For local image updates,
rebuild from the updated source and recreate the container, preserving the appdata
mapping. Registry-based automatic image updates are not available for this local
build.

## YouTube setup

1. Enable **YouTube Data API v3** in your Google Cloud project.
2. Create a server API key, restrict it to that API (and your egress IP if fixed),
   and set `YOUTUBE_API_KEY`.
3. Set `YOUTUBE_VIDEO_ID=n7PhqM770oM` for the current broadcast (use the video ID,
   not its full URL). Clear `YOUTUBE_LIVE_CHAT_ID` when switching broadcasts so
   an old chat ID does not override the video ID. The worker
   obtains `liveStreamingDetails.activeLiveChatId` through `videos.list` and waits
   if the scheduled stream has not started. Alternatively set `YOUTUBE_LIVE_CHAT_ID`
   directly; this takes precedence over the video ID.
4. The stream must expose an accessible live chat. This API-key setup targets
   public streams; private broadcasts requiring OAuth are not supported.

Polling uses `liveChatMessages.list`, follows `nextPageToken`, and waits at least
`pollingIntervalMillis`. The first page is skipped because it contains history;
messages arriving before this first response can therefore also be skipped.
Network/rate-limit failures back off. Invalid page tokens reset to a fresh cursor
and skip history again. Ended/disabled chat stops the YouTube listener while
Twitch continues. Change the video/chat ID and restart for the next broadcast;
channel-wide discovery is not implemented. Quota/access errors exit visibly for
operator correction instead of continuing to consume quota.

Google now recommends `streamList` to reduce polling/quota overhead; this service
uses `list` as requested. Check your project's quota before a long stream.

## Twitch setup

1. Register an application in the [Twitch developer console](https://dev.twitch.tv/console/apps).
2. Authorize the account that reads chat (your account or a bot) with a **user access
   token** granting `user:read:chat`. Use the authorization-code flow if you want a
   refresh token. An app/client-credentials access token will not work here.
3. Set `TWITCH_CLIENT_ID`, `TWITCH_ACCESS_TOKEN` (raw token, without `oauth:` or
   `Bearer`), `TWITCH_BOT_USER_ID` (the token owner's numeric user ID), and
   `TWITCH_BROADCASTER_ID` (the channel owner's numeric user ID). The two user IDs
   may be the same. IDs can be obtained from Twitch's Get Users endpoint.
4. For unattended operation set `TWITCH_CLIENT_SECRET`, `TWITCH_REFRESH_TOKEN`,
   and `TWITCH_TOKEN_FILE=/data/twitch-tokens.json`. Preserve the volume across
   restarts. Saved tokens take precedence over environment tokens; delete the
   saved token file when intentionally changing accounts or reauthorizing.

Twitch EventSub **WebSockets** deliver `channel.chat.message` without a public
HTTPS callback, webhook signature handling, or inbound firewall configuration.
The service validates the token on startup and at least hourly, refreshes it when
configured, subscribes after welcome, monitors keepalives, reconnects after
failures, and migrates subscriptions on server-requested reconnects. A revoked
subscription or invalid credentials stops the service. Without refresh credentials,
replace expired access tokens manually and restart.

## Delivery and shutdown

- Up to 10 cloud requests run concurrently. Each response is checked, and a free
  slot immediately takes the next command without waiting for the other requests.
  Concurrent requests may enter the cloud queue out of chat arrival order.
- A shared queue holds up to 1,000 waiting commands, in addition to the 10 in
  flight; newest commands are dropped
  with a warning when full. Recent 10,000 accepted source/message IDs are kept in
  memory to suppress duplicate notifications.
- Cloud submissions have a 20-second timeout and are attempted once. Rejections
  and uncertain deliveries are logged, without chat text or credentials. The API
  has no idempotency support, so retrying a timeout or 5xx could duplicate a color
  already queued. Cloud authentication failures stop the worker.
- This is best-effort delivery: queued messages/deduplication state are not durable,
  platform outages can lose messages, and restarts/multiple instances do not give
  exactly-once delivery. The Twitch API does not replay events missed while offline.
- SIGTERM/SIGINT stops ingestion and allows 25 seconds to drain queued commands.
  If YouTube ends and Twitch is disabled, the process exits after draining; the
  supplied `unless-stopped` policy restarts it, so stop the container when finished.

## Local run and tests

```sh
python3 -m venv .venv-stream
.venv-stream/bin/pip install -r stream_aggregator/requirements.txt pytest
# Export the variables from .env.example into your shell first.
.venv-stream/bin/python -m stream_aggregator
.venv-stream/bin/python -m pytest stream_aggregator/tests -q
```

Tests use fakes and do not read your credentials or submit real colors.

Protocol references: [YouTube polling](https://developers.google.com/youtube/v3/live/docs/liveChatMessages/list),
[Twitch WebSockets](https://dev.twitch.tv/docs/eventsub/handling-websocket-events/),
[Twitch token validation](https://dev.twitch.tv/docs/authentication/validate-tokens/),
[Twitch OAuth authorization code flow](https://dev.twitch.tv/docs/authentication/getting-tokens-oauth/#authorization-code-grant-flow).
