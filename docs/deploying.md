# Deploying

How to ship a change to each part of RGBoo, and how to undo it.

**Nothing deploys on merge.** [pr-checks.yaml](../.github/workflows/pr-checks.yaml)
runs tests on pull requests only. Deploys are always something you trigger:
either the button below, or the commands by hand.

One-time provisioning lives in [gcp-setup.md](gcp-setup.md); how the system
fits together is [architecture.md](architecture.md).

| Change in | Deploys to | Section |
|---|---|---|
| `cloud_api/`, `shared/` | Cloud Run | [1](#1-cloud-api--cloud-run) |
| `bridge/`, `shared/` | The home machine | [2](#2-bridge--home-machine) |
| `web/` (app or Worker) | Cloudflare | [3](#3-web--cloudflare) |
| `firmware/` | ESP32 over USB | [4](#4-firmware--esp32) |
| `main` (preview) | staging.rgboo.com | [5](#5-staging-environment) |

A change to `cloud_api/` alone needs no bridge action — the two share only
Firestore document fields, not code. Order matters only when a change spans
both: **API first, bridge second.** The API writes pending documents and the
bridge reads them, so a bridge that is briefly behind sits idle, which is
recoverable; the reverse can drop requests.

---

## 1. Cloud API → Cloud Run

### The button (preferred)

**Actions → Deploy API → Run workflow.**

| Input | Meaning |
|---|---|
| `tag` | Image tag, e.g. `v3`. Must be new — the run fails rather than overwrite one, so every deploy stays a distinct rollback target. |
| `confirm` | Unchecked (default): tests, builds, and pushes the image but **does not touch live traffic**. Checked: also deploys and verifies. |

Leaving `confirm` unchecked is a safe rehearsal — it proves the image builds
and the tests pass without changing anything users touch.

The run tests `cloud_api/`, builds, pushes, deploys, then fails unless the
health endpoint returns 200 *and* an unauthenticated request still returns
401. The summary shows the new revision and the exact rollback command.

It authenticates by Workload Identity Federation, so no service-account key is
stored in GitHub. The identity `rgboo-deployer@rgboo-leds.iam.gserviceaccount.com`
can push images and deploy Cloud Run — nothing else. It cannot read Firestore,
change IAM, or touch billing. GCP only accepts OIDC tokens whose `repository`
claim is `nrodd/rgboo`.

> The button only appears once `deploy-api.yaml` is on the **default branch**.
> That is a GitHub rule for `workflow_dispatch`, not a project choice.

### By hand

```bash
export PROJECT_ID="rgboo-leds"
export REGION="us-east1"
export SERVICE="rgboo-api"
export TAG="v3"                     # bump every deploy; never reuse a tag
export IMAGE="${REGION}-docker.pkg.dev/${PROJECT_ID}/rgboo/${SERVICE}:${TAG}"
```

Run from the **repo root** — the image needs both `cloud_api/` and `shared/`,
which is why the build goes through [cloudbuild.yaml](../cloudbuild.yaml)
rather than `--source cloud_api/`:

```bash
pytest cloud_api/tests -q

# Cloud Build, so the image is amd64 regardless of your machine
gcloud builds submit --project="$PROJECT_ID" \
  --config cloudbuild.yaml --substitutions=_IMAGE="$IMAGE" .

gcloud run deploy "$SERVICE" --project="$PROJECT_ID" \
  --image="$IMAGE" --region="$REGION" --platform=managed
```

Building locally works too, but an Apple Silicon Mac must cross-build or Cloud
Run rejects the image:

```bash
docker buildx build --platform linux/amd64 -f cloud_api/Dockerfile -t "$IMAGE" --push .
```

`API_KEY` and the other env vars carry over from the previous revision — do
not pass `--set-env-vars` again unless you mean to replace *all* of them
(`--update-env-vars` changes one safely).

The admin page and `/admin-api/*` path must be protected by the Cloudflare
Access email allowlist. The Worker proxies that path to Cloud Run and forwards
the existing `X-Api-Key`; no admin key belongs in the browser.

Verify:

```bash
URL="$(gcloud run services describe "$SERVICE" --project="$PROJECT_ID" \
  --region="$REGION" --format='value(status.url)')"
curl -s "$URL/" | jq
```

Or run the whole Postman collection as a smoke test — 11 requests, 26
assertions, about 2 seconds:

```bash
npx newman run postman/rgboo-api.postman_collection.json \
  -e postman/rgboo-cloud.postman_environment.json --env-var "api_key=$API_KEY"
```

See [postman/README.md](../postman/README.md).

### Rolling back the API

Every deploy creates a revision and old ones stay. Rollback is a traffic
switch — no rebuild, seconds:

```bash
gcloud run revisions list --project="$PROJECT_ID" --region="$REGION" \
  --service="$SERVICE" --format="table(metadata.name,metadata.creationTimestamp)"

gcloud run services update-traffic "$SERVICE" --project="$PROJECT_ID" \
  --region="$REGION" --to-revisions=<previous-revision>=100

# back to newest once fixed
gcloud run services update-traffic "$SERVICE" --project="$PROJECT_ID" \
  --region="$REGION" --to-latest
```

Logs:

```bash
gcloud logging read \
  'resource.type="cloud_run_revision" AND resource.labels.service_name="rgboo-api" AND severity>=ERROR' \
  --project="$PROJECT_ID" --limit=20 --freshness=1h --format="value(textPayload)"
```

---

## 2. Bridge → home machine

The bridge runs behind home NAT, so nothing can push to it — you pull. Run
these **on that machine**:

```bash
cd /opt/rgboo                     # wherever the checkout lives
git pull

# only when bridge/requirements.txt changed
.venv/bin/pip install -r bridge/requirements.txt

sudo systemctl restart rgboo-bridge
journalctl -u rgboo-bridge -f
```

Restarting mid-queue is safe: pending requests live in Firestore, so the
bridge picks them back up and overdue slots dispatch immediately.

Confirm the cloud sees it, within about a minute:

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

If it will not start, stop it and fall back to the old middleware — they must
never run at once, since both want the same USB port:

```bash
sudo systemctl stop rgboo-bridge
```

First-time install: [bridge/README.md](../bridge/README.md).

---

## 3. Web → Cloudflare

Deploys the React app and the Worker together:

```bash
cd web
yarn test
yarn deploy        # = yarn build && wrangler deploy
```

Check the Cloudflare dashboard first — if this repo is connected to Workers
Builds, pushes may already deploy on their own.

Changing which API the Worker targets is an edit to `API_UPSTREAM` in
[web/wrangler.jsonc](../web/wrangler.jsonc) plus `yarn deploy`. That edit *is*
the Phase 5 cutover and its rollback. Secrets upload separately:

```bash
wrangler secret put API_KEY        # value comes from the Cloud Run service
```

Read the current key back:

```bash
gcloud run services describe rgboo-api --project=rgboo-leds --region=us-east1 \
  --format=json | python3 -c \
  "import json,sys; print(next(e['value'] for e in json.load(sys.stdin)['spec']['template']['spec']['containers'][0]['env'] if e['name']=='API_KEY'))"
```

### Rolling back the web app

Edit the value back and `yarn deploy`, or roll back from the Cloudflare
dashboard (Workers → rgboo → Deployments). The dashboard route needs no
rebuild.

Details: [web/web.md](../web/web.md).

---

## 4. Firmware → ESP32

```bash
cd firmware
pio run
pio run --target upload
pio device monitor
```

Stop the bridge (or the old middleware) first — whatever owns the serial port
blocks the upload.

---

## 5. Staging environment

While production is pinned to `see-you-next-october`, the `main` branch runs at
**staging.rgboo.com**, gated to invited users and auto-deployed on every push to
`main`. It's a second Cloudflare Worker, `rgboo-staging`, defined by the
`env.staging` block in [web/wrangler.jsonc](../web/wrangler.jsonc). Production is
the top-level worker (`rgboo`) and is never touched by a staging deploy.

Standing up staging is three things — the worker (in this repo), one CI secret,
and one piece of Cloudflare dashboard config, each done once.

> **Deploy staging with `yarn deploy:staging`, never `wrangler deploy --env
> staging`.** The `@cloudflare/vite-plugin` selects the environment at *build*
> time from the `CLOUDFLARE_ENV` variable, so the `--env` flag on `deploy` is
> ignored and silently ships the top-level **production** worker instead. The
> `deploy:staging` script sets `CLOUDFLARE_ENV=staging` on the build for you.
> (Secrets are a plain wrangler call and *do* honour `--env staging`.)

### a. The worker

```bash
cd web
yarn deploy:staging                          # CLOUDFLARE_ENV=staging build, then wrangler deploy
wrangler secret put API_KEY --env staging    # same shared key as prod (read it from Cloud Run, §3)
```

`custom_domain: true` on the route makes Cloudflare create the `staging.rgboo.com`
DNS record and cert automatically, since rgboo.com is already on Cloudflare. The
staging worker has `workers_dev` and `preview_urls` turned off so it's reachable
only at that gated hostname — a `*.workers.dev` URL would sit in front of Access
and bypass the login wall.

`API_KEY` is the one Cloud Run shared secret; the same value guards both the
public and admin API (the admin difference is Access, not a second key). Read the
current value with the command in [§3](#3-web--cloudflare).

### b. Gate it — Cloudflare Access

The same email-allowlist mechanism that protects `/admin`, applied to the whole
hostname. In **Zero Trust → Access → Applications**, add a self-hosted app for
`staging.rgboo.com` with an allow policy listing the permitted emails. Visitors
hit an email-OTP login before the site loads. Free up to 50 users.

Note: `API_UPSTREAM` points at the **production** Cloud Run API, so anything
submitted on staging drives the real LEDs and shares the prod queue. To isolate
staging from hardware, deploy a second Cloud Run service against a separate
Firestore database (the bridge only watches prod's database) and point the
staging `API_UPSTREAM` there instead.

### c. Auto-deploy on push to `main`

[deploy-staging.yaml](../.github/workflows/deploy-staging.yaml) builds and
deploys `rgboo-staging` on every push to `main` that touches `web/`. It only
needs two repo secrets (**Settings → Secrets and variables → Actions**):

| Secret | Value |
|---|---|
| `CLOUDFLARE_API_TOKEN` | A token scoped to **Workers Scripts:Edit** on the rgboo account |
| `CLOUDFLARE_ACCOUNT_ID` | The rgboo Cloudflare account ID |

Unlike the API deploy, there's no Workload Identity path for Cloudflare, so this
token has to be stored. It can push workers and nothing else. The workflow never
targets the production `rgboo` worker.

### Promoting `main` to production

When it's time to make `main` the real site, deploy it to the top-level (prod)
worker by hand — one command from a `main` checkout:

```bash
cd web
yarn deploy          # no CLOUDFLARE_ENV => top-level prod worker `rgboo`
```

Roll back from the Cloudflare dashboard (Workers → rgboo → Deployments → roll
back), or `wrangler rollback <version-id>`. Once you're done with staging, remove
its Access policy and disable the staging workflow.

---

## What is not automated, and why

**The bridge cannot have a button.** It runs behind home NAT with no inbound
access — the entire reason it exists. The most a workflow could do is have the
machine poll for a new commit and restart itself.

**Staging auto-deploys; production is deliberately by hand.** Pushes to `main`
ship staging automatically ([§5c](#c-auto-deploy-on-push-to-main)), but the
production `rgboo` worker only moves when someone runs `yarn deploy` — so cutover
from the countdown to `main` stays a deliberate choice.

**Nothing deploys on merge, deliberately.** Through Phases 5 and 6, choosing
the moment production changes is the point — the cutover and its rollback
drill both depend on it.
