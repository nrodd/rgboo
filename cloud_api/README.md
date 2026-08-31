# cloud_api

Flask API for RGBoo, deployed to Cloud Run. See `docs/gcp-migration-plan.md`
for the full design; this is just the how-to-run.

## Local development

Run from the repo root, so `shared/` resolves:

```
python -m venv .venv && source .venv/bin/activate
pip install -r cloud_api/requirements.txt
export API_KEY=dev-secret
export GOOGLE_APPLICATION_CREDENTIALS=/path/to/a/service-account-key.json
python -m cloud_api.app
```

This talks to a real Firestore database (Phase 4 of the migration plan
creates one) -- there's no local emulator wired up here.

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
docker run -p 8080:8080 -e API_KEY=dev-secret rgboo-api
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
