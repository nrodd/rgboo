# Deploying

How to ship each part of RGBoo, and how to undo it. Structure and security
posture are in [architecture.md](architecture.md).

**Merging to `main` deploys the Cloud API. Nothing else deploys itself.**

| Change in | Goes to | How |
|---|---|---|
| `cloud_api/`, `shared/` | Cloud Run | [Automatic on merge](#1-cloud-api--cloud-run) |
| `bridge/`, `shared/` | The home machine | [By hand, on that machine](#2-bridge--home-machine) |
| `web/` (app or Worker) | Cloudflare | [`yarn deploy`](#3-web--cloudflare) |
| `firmware/` | ESP32 over USB | [`pio run -t upload`](#4-firmware--esp32) |

When a change spans the API and the bridge, deploy **API first, bridge
second**. They share Firestore document fields, not code, so a bridge that is
briefly behind just sits idle; the reverse can drop requests.

---

## 1. Cloud API → Cloud Run

Merging to `main` with changes under `cloud_api/` or `shared/` runs
[deploy-api.yaml](../.github/workflows/deploy-api.yaml): test, build, deploy,
verify. It fails unless `/` returns 200 **and** an unauthenticated
`/api/status` returns 401, and on failure puts traffic back on the revision
that was serving before it. Images are tagged `sha-<short-sha>`, so the live
revision always names the commit that made it. The run summary has the new
revision and its rollback command.

To deploy without a merge — rolling forward after a rollback, or a hotfix
branch — use **Actions → Deploy API → Run workflow** and pick a ref. It takes
no inputs and does the same thing to whatever commit you choose, reviewed or
not, which is the reason to reach for it rarely.

### By hand

Rarely needed. Run from the **repo root**: the image needs `shared/` as well as
`cloud_api/`, which is why it builds through
[cloudbuild.yaml](../cloudbuild.yaml) rather than `--source cloud_api/`.

```bash
export PROJECT_ID="rgboo-leds" REGION="us-east1" SERVICE="rgboo-api"
export IMAGE="${REGION}-docker.pkg.dev/${PROJECT_ID}/rgboo/${SERVICE}:sha-$(git rev-parse --short HEAD)"

pytest cloud_api/tests -q

# Cloud Build, so the image is amd64 whatever your machine is. Locally you must
# cross-build or Cloud Run rejects it:
#   docker buildx build --platform linux/amd64 -f cloud_api/Dockerfile -t "$IMAGE" --push .
gcloud builds submit --project="$PROJECT_ID" \
  --config cloudbuild.yaml --substitutions=_IMAGE="$IMAGE" .

gcloud run deploy "$SERVICE" --project="$PROJECT_ID" \
  --image="$IMAGE" --region="$REGION" --platform=managed

curl -s "$(gcloud run services describe "$SERVICE" --project="$PROJECT_ID" \
  --region="$REGION" --format='value(status.url)')/" | jq
```

`API_KEY` and the other env vars carry over from the previous revision. Do not
pass `--set-env-vars` unless you mean to replace *all* of them —
`--update-env-vars` changes one safely.

Smoke test the result (11 requests, 26 assertions, about 2 seconds):

```bash
npx newman run postman/rgboo-api.postman_collection.json \
  -e postman/rgboo-cloud.postman_environment.json --env-var "api_key=$API_KEY"
```

### Rolling back the API

Every deploy leaves its revision behind, so rollback is a traffic switch — no
rebuild, seconds:

```bash
gcloud run revisions list --project="$PROJECT_ID" --region="$REGION" \
  --service="$SERVICE" --format="table(metadata.name,metadata.creationTimestamp)"

gcloud run services update-traffic "$SERVICE" --project="$PROJECT_ID" \
  --region="$REGION" --to-revisions=<previous-revision>=100

# back to newest once fixed
gcloud run services update-traffic "$SERVICE" --project="$PROJECT_ID" \
  --region="$REGION" --to-latest
```

Errors from the last hour:

```bash
gcloud logging read \
  'resource.type="cloud_run_revision" AND resource.labels.service_name="rgboo-api" AND severity>=ERROR' \
  --project="$PROJECT_ID" --limit=20 --freshness=1h --format="value(textPayload)"
```

---

## 2. Bridge → home machine

The bridge sits behind home NAT, so nothing can push to it — you pull. Run
these **on that machine** (first-time install: [bridge/README.md](../bridge/README.md)):

```bash
cd /opt/rgboo                     # wherever the checkout lives
git pull
.venv/bin/pip install -r bridge/requirements.txt   # only if that file changed
sudo systemctl restart rgboo-bridge
journalctl -u rgboo-bridge -f
```

Restarting mid-queue is safe: pending requests live in Firestore, so the bridge
picks them back up and overdue slots dispatch immediately. Within a minute the
cloud should agree:

```bash
curl -s https://rgboo-api-186324327580.us-east1.run.app/ | jq '.bridge_online, .serial_connected'
# true, true   (serial_connected is false in --dry-run, which is correct)
```

### Rolling back the bridge

```bash
git log --oneline -5
git checkout <last-good-sha>
sudo systemctl restart rgboo-bridge
```

If it will not start, `sudo systemctl stop rgboo-bridge` and fall back to the
old middleware — never both at once, since they want the same USB port.

---

## 3. Web → Cloudflare

Ships the React app and the Worker together. Check the Cloudflare dashboard
first: if this repo is connected to Workers Builds, pushes may already deploy
on their own.

```bash
cd web
yarn test
yarn deploy        # = yarn build && wrangler deploy
```

Which API the Worker targets is `API_UPSTREAM` in
[web/wrangler.jsonc](../web/wrangler.jsonc) — edit plus `yarn deploy`. Secrets
upload separately, the value coming from the Cloud Run service:

```bash
wrangler secret put API_KEY

# read the current one back
gcloud run services describe rgboo-api --project=rgboo-leds --region=us-east1 \
  --format=json | python3 -c \
  "import json,sys; print(next(e['value'] for e in json.load(sys.stdin)['spec']['template']['spec']['containers'][0]['env'] if e['name']=='API_KEY'))"
```

**Rollback:** edit the value back and `yarn deploy`, or use the Cloudflare
dashboard (Workers → rgboo → Deployments), which needs no rebuild. Details:
[web/web.md](../web/web.md).

---

## 4. Firmware → ESP32

Stop the bridge (or the old middleware) first — whatever owns the serial port
blocks the upload.

```bash
cd firmware
pio run
pio run --target upload
pio device monitor
```

---

## Why only the API is automated

It is the only piece with a real verification step and a one-command rollback,
which is what makes shipping it unattended safe.

The bridge **cannot** have a button: it lives behind home NAT with no inbound
access, which is the entire reason it exists. The most a workflow could do is
have the machine poll for a new commit and restart itself. The web app has no
button **yet** — it needs a Cloudflare API token as a repository secret, and
setting those requires admin on `nrodd/rgboo`.
