# cloud_api

Flask API for RGBoo, deployed to Cloud Run. See `docs/gcp-migration-plan.md`
for the full design; this is just the how-to-run.

## Local development

New here? `docs/local-setup.md` is the full walkthrough, including access and
credentials. The short version:

Run the complete local stack from the repo root:

```
./scripts/setup.sh
./scripts/dev.sh
```

This starts Firestore Emulator Suite and forces both the API and bridge to use
it. No Google credentials or production project access is needed. See
[`docs/local-setup.md`](../docs/local-setup.md) for the local browser and
admin URLs.

## Poking at it by hand

`postman/` has a collection and environments for local and deployed targets --
see `postman/README.md`.

## Tests

Tests use fakes/mocks for the store, so no GCP credentials or network
access are required:

```
pip install pytest
pytest cloud_api/tests -q
```

## Docker build

Build context must be the repo root, since the image also needs `shared/`:

```
docker build -f cloud_api/Dockerfile -t rgboo-api .
docker run -p 8080:8080 -e API_KEY=local-api-secret rgboo-api
```

(Needs `GOOGLE_APPLICATION_CREDENTIALS` / ADC to actually reach Firestore.)

## Deploying

Live on Cloud Run at https://rgboo-api-186324327580.us-east1.run.app
(project `rgboo-leds`, region `us-east1`).

Deploy with the **Deploy API** workflow: Actions -> Deploy API -> Run
workflow, giving it a new image tag. Leave `confirm` unchecked to build and
test without touching live traffic.

Full steps, the by-hand equivalent, and rollback: `docs/deploying.md`.
One-time provisioning: `docs/gcp-setup.md`.
