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
After a successful queued response, the worker posts an acknowledgement in the
originating chat, for example: `@ViewerName your color is queued! Estimated wait: 42 seconds.`
The estimate comes from `estimated_wait_seconds` (fractional seconds round up).
Twitch replies are attached to the original message and mention the user login;
YouTube messages address the author with `@displayName` text. YouTube does not
provide a structured mention field, so a notification is not guaranteed.

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

The image runs as non-root (UID 10001). The named volume stores YouTube quota counters and rotated Twitch
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

The `/data` mapping preserves YouTube quota counters and refreshed Twitch credentials in Unraid's appdata
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
3. Set `YOUTUBE_CHANNEL_ID` to the channel's ID (not its `@handle`, which can be
   renamed). The worker looks up whatever that channel is currently streaming
   through `search.list`, then obtains `liveStreamingDetails.activeLiveChatId`
   for it through `videos.list`, waiting if nothing is live yet. To pin a
   specific broadcast instead, set `YOUTUBE_VIDEO_ID`; to skip both lookups, set
   `YOUTUBE_LIVE_CHAT_ID` directly. Each takes precedence over the one before it
   in that order.
4. Authorize the account that will post estimates using Google OAuth with the
   `https://www.googleapis.com/auth/youtube.force-ssl` scope. Set
   `YOUTUBE_ACCESS_TOKEN` for a short-lived session, or (recommended) set
   `YOUTUBE_CLIENT_ID`, `YOUTUBE_CLIENT_SECRET`, and `YOUTUBE_REFRESH_TOKEN`
   from an authorization-code flow with offline access. The worker refreshes
   access tokens automatically before posting; an access-token-only setup needs
   manual replacement and a restart when it expires. The API key alone cannot
   post chat messages. See [Google OAuth setup](https://developers.google.com/identity/protocols/oauth2/web-server)
   and [posting live chat messages](https://developers.google.com/youtube/v3/live/docs/liveChatMessages/insert).
5. The stream must expose an accessible live chat. This API-key setup targets
   public streams; private broadcasts requiring OAuth are not supported.

Chat ingestion uses Google's `liveChatMessages.streamList` gRPC service over a
long-lived TLS connection to `youtube.googleapis.com:443`. There is no REST chat
polling fallback and no periodic reconnect for a quiet chat. Network failures
reconnect with exponential backoff (5 seconds up to 5 minutes), passing the last
`nextPageToken`. Initial history can span multiple batches: only messages with a
publication timestamp at or after this worker's startup are accepted. Keep the
host clock synchronized. Invalid resume cursors reset that cutoff to the current
time so old commands are not replayed. Deduplication still applies across reconnects.

If nothing is discovered yet (the channel isn't live, or the resolved video has
no active chat), discovery retries every five minutes. The channel lookup
(`search.list`) costs far more quota than `videos.list`, so it only re-runs on
those retries rather than on every reconnect. Ended/disabled chats stop the
YouTube listener; Twitch can continue independently.

### Daily quota protection

Streamed reads reduce request volume, but **posting each estimate still costs 50
quota units**. Replies are therefore best-effort, subject to these local limits:

| Variable | Default | Behavior |
| --- | --- | --- |
| `YOUTUBE_DAILY_REPLIES` | `160` | Maximum reply attempts per Pacific day (8,000 units). Set `0` to disable replies. |
| `YOUTUBE_DAILY_READS` | `1000` | Maximum video discovery calls and stream connection attempts per Pacific day. |
| `YOUTUBE_BUDGET_FILE` | `/data/youtube-budget.sqlite3` | SQLite counters and quota-exhaustion state; persist this file across restarts. |

Limits may be lowered but cannot exceed these ceilings. Keep the existing `/data`
volume mounted and writable by UID 10001. For a local run, set the budget file to
a writable persistent path. Counters reserve attempts **before** sending, including
failed/uncertain deliveries; restarting does not restore the allowance. Counters
reset at midnight America/Los_Angeles, including daylight-saving changes.

When replies reach their cap, colors continue to be forwarded without a YouTube
acknowledgement. When the read budget is reached, discovery/reconnections pause
until the next Pacific day. An already-open stream can continue receiving messages.
A Google quota-exhaustion response blocks further local attempts until the next
reset plus one minute. gRPC `RESOURCE_EXHAUSTED` may mean a rate or quota limit;
we conservatively pause until reset for either rather than repeatedly reconnect.
The listener waits without exiting, so quota exhaustion does not create a Docker
restart loop and Twitch remains available.

These are **local request safeguards, not a reading of Google's project quota**.
Other programs, separate budget files/containers, usage before this deployment,
and changes to Google's streaming accounting can still exhaust the project quota.
Use one aggregator, inspect the project's quota metrics, and lower the reply cap
if the project is shared. A fresh budget file does not know today's earlier usage.
More than 160 daily acknowledgements requires a separately planned quota increase
or a different acknowledgement design; do not reset/delete counters to bypass caps.

References: [streamList](https://developers.google.com/youtube/v3/live/docs/liveChatMessages/streamList),
[streaming client/schema](https://developers.google.com/youtube/v3/live/streaming-live-chat),
[quota costs and reset time](https://developers.google.com/youtube/v3/determine_quota_cost).

`stream_list.proto` is the minimal wire-compatible subset needed for text commands.
The generated `stream_list_pb2.py` is committed and copied into the Docker image;
no compiler is required at runtime. To regenerate after changing the schema:

```sh
python -m pip install grpcio-tools==1.78.0
python -m grpc_tools.protoc -I stream_aggregator --python_out=stream_aggregator stream_aggregator/stream_list.proto
```

## Twitch setup

1. Register an application in the [Twitch developer console](https://dev.twitch.tv/console/apps).
2. Authorize the account that reads chat (your account or a bot) with a **user access
   token** granting both `user:read:chat` and `user:write:chat`.
   Existing read-only tokens must be reauthorized with both scopes. Use the authorization-code flow if you want a
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
- Chat replies are attempted only after a queued response with a valid nonnegative
  estimate. Rejected requests and missing/invalid estimates produce no reply.
  Reply failures (including platform rate limits) are logged without retrying
  either the reply or the accepted color. Replies consume platform quota and
  are included in the shutdown drain deadline.
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

Protocol references: [YouTube streaming](https://developers.google.com/youtube/v3/live/docs/liveChatMessages/streamList),
[Twitch WebSockets](https://dev.twitch.tv/docs/eventsub/handling-websocket-events/),
[Twitch token validation](https://dev.twitch.tv/docs/authentication/validate-tokens/),
[Twitch OAuth authorization code flow](https://dev.twitch.tv/docs/authentication/getting-tokens-oauth/#authorization-code-grant-flow).
