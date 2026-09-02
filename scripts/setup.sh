#!/usr/bin/env bash
#
# One-command local setup for the cloud API and the bridge.
# Safe to re-run: it never overwrites an existing .venv or .env.
#
#   ./scripts/setup.sh
#
# See docs/local-setup.md for what this is doing and why.

set -euo pipefail

# Work from the repo root regardless of where this was invoked, since both
# packages import shared/ and only resolve correctly from there.
cd "$(dirname "${BASH_SOURCE[0]}")/.."

VENV=".venv"
ok()   { printf '  \033[32m✓\033[0m %s\n' "$1"; }
warn() { printf '  \033[33m!\033[0m %s\n' "$1"; }
bad()  { printf '  \033[31m✗\033[0m %s\n' "$1"; }
step() { printf '\n\033[1m%s\033[0m\n' "$1"; }

step "1. Checking prerequisites"

if ! command -v python3 >/dev/null 2>&1; then
  bad "python3 not found. Install Python 3.12 and re-run."
  exit 1
fi

PY_VERSION="$(python3 -c 'import sys; print("%d.%d" % sys.version_info[:2])')"
case "$PY_VERSION" in
  3.12) ok "python3 $PY_VERSION (matches the container)" ;;
  3.1[0-9]) warn "python3 $PY_VERSION — works, but production runs 3.12" ;;
  *) bad "python3 $PY_VERSION is too old; this needs 3.10+"; exit 1 ;;
esac

if command -v gcloud >/dev/null 2>&1; then
  ok "gcloud installed"
else
  warn "gcloud not found — needed for Firestore credentials"
  warn "install: https://cloud.google.com/sdk/docs/install"
fi

step "2. Virtualenv"

if [ -d "$VENV" ]; then
  ok "$VENV already exists (delete it to start fresh)"
else
  python3 -m venv "$VENV"
  ok "created $VENV"
fi

# Use the venv's interpreter directly; no need to source an activate script.
PY="$VENV/bin/python"

step "3. Dependencies"

"$PY" -m pip install --quiet --upgrade pip
"$PY" -m pip install --quiet \
  -r cloud_api/requirements.txt \
  -r bridge/requirements.txt \
  pytest
ok "installed cloud_api, bridge, and pytest"

step "4. Environment file"

if [ -f .env ]; then
  ok ".env already exists (left untouched)"
else
  cp .env.example .env
  ok "created .env from .env.example"
fi

step "5. Google credentials"

if ! command -v gcloud >/dev/null 2>&1; then
  warn "skipped — gcloud not installed"
elif gcloud auth application-default print-access-token >/dev/null 2>&1; then
  ok "application default credentials are present"
else
  warn "no application default credentials yet. Run:"
  printf '      gcloud auth application-default login\n'
  printf '      gcloud auth application-default set-quota-project rgboo-leds\n'
  warn "you also need to be in rgboo@googlegroups.com for Firestore access"
fi

step "6. Smoke test"

# These use mocks, so they pass with no credentials and no network. If this
# succeeds but the app fails to start, the problem is credentials, not setup.
if "$PY" -m pytest cloud_api/tests bridge/tests -q >/dev/null 2>&1; then
  ok "test suite passes"
else
  bad "tests failed — run: $PY -m pytest cloud_api/tests bridge/tests"
  exit 1
fi

step "Ready"
cat <<'NEXT'
  Start everything with:

      ./scripts/dev.sh

  That runs the API on :8080 and the bridge in dry run, together, in this
  terminal. Ctrl-C stops both.

  Remember: there is no local database. Both talk to the real shared
  Firestore, so use an obvious test username and clean up after yourself.
  Details in docs/local-setup.md.
NEXT
