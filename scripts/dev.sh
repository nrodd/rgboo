#!/usr/bin/env bash
#
# Run the full local stack in one terminal.
# Ctrl-C stops all services.
#
#   ./scripts/dev.sh                 Firestore + API + bridge + web (dry run)
#   ./scripts/dev.sh --api-only      Firestore + API
#   ./scripts/dev.sh --bridge-only   Firestore + bridge
#   ./scripts/dev.sh --no-web        Firestore + API + bridge, no Vite server
#   ./scripts/dev.sh --real-serial   drive actual hardware (see below)
#
# Settings come from .env. This script always overrides Firestore settings to
# use the local emulator; it never connects to production Firestore.

set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."

VENV=".venv"
PY="$VENV/bin/python"
OBS_PORT="${BRIDGE_OBS_PORT:-5077}"
FIRESTORE_PORT=8081
FIREBASE_UI_PORT=4000
WEB_PORT="${RGBOO_WEB_PORT:-5173}"
LOCAL_PROJECT_ID="rgboo-local"
RUN_API=true
RUN_BRIDGE=true
RUN_WEB=true
DRY_RUN=true

for arg in "$@"; do
  case "$arg" in
    --api-only)     RUN_BRIDGE=false; RUN_WEB=false ;;
    --bridge-only)  RUN_API=false; RUN_WEB=false ;;
    --no-web)       RUN_WEB=false ;;
    --real-serial)  DRY_RUN=false ;;
    -h|--help)      sed -n '2,14p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) printf 'unknown option: %s (try --help)\n' "$arg" >&2; exit 1 ;;
  esac
done

if [ ! -x "$PY" ]; then
  printf 'No virtualenv found. Run ./scripts/setup.sh first.\n' >&2
  exit 1
fi

if [ ! -f .env ]; then
  printf 'No .env found. Run ./scripts/setup.sh, or: cp .env.example .env\n' >&2
  exit 1
fi

if ! command -v firebase >/dev/null 2>&1; then
  printf 'Firebase CLI not found. Install it, then run ./scripts/setup.sh.\n' >&2
  exit 1
fi

if $RUN_WEB && [ ! -x web/node_modules/.bin/vite ]; then
  printf 'Web dependencies are missing. Run ./scripts/setup.sh first.\n' >&2
  exit 1
fi

# A port already in use usually means a previous run did not shut down, and the
# resulting error is much less obvious than saying so up front.
port_busy() { lsof -nP -iTCP:"$1" -sTCP:LISTEN >/dev/null 2>&1; }

if port_busy "$FIRESTORE_PORT"; then
  printf 'Port %s is already in use — is another Firestore emulator running?\n' "$FIRESTORE_PORT" >&2
  exit 1
fi
if port_busy "$FIREBASE_UI_PORT"; then
  printf 'Port %s is already in use — is another Firebase Emulator UI running?\n' "$FIREBASE_UI_PORT" >&2
  exit 1
fi
if $RUN_API && port_busy 8080; then
  printf 'Port 8080 is already in use — is another API still running?\n' >&2
  exit 1
fi
if $RUN_BRIDGE && port_busy "$OBS_PORT"; then
  printf 'Port %s is in use. Set BRIDGE_OBS_PORT to something else.\n' "$OBS_PORT" >&2
  exit 1
fi
if $RUN_WEB && port_busy "$WEB_PORT"; then
  printf 'Port %s is already in use — is another Vite server still running?\n' "$WEB_PORT" >&2
  exit 1
fi

# These are deliberately assigned after reading .env. A local dev session must
# not accidentally use a developer's production project or credentials.
export GOOGLE_CLOUD_PROJECT="$LOCAL_PROJECT_ID"
export FIRESTORE_EMULATOR_HOST="127.0.0.1:${FIRESTORE_PORT}"

# Vite needs the same API key as Flask, but it cannot read the root .env on its
# own. Only parse this one simple KEY=value setting; never source .env as shell.
LOCAL_API_KEY="$(awk -F= '$1 == "API_KEY" { sub(/^[^=]*=/, ""); sub(/\r$/, ""); print; exit }' .env)"
LOCAL_API_KEY="${LOCAL_API_KEY:-local-api-secret}"

pids=()

# Stop everything on Ctrl-C. Each job is a subshell wrapping a pipeline, so
# kill the subshell and its children rather than just the subshell.
cleanup() {
  trap - EXIT INT TERM
  printf '\n\033[2mstopping…\033[0m\n'
  # Signal the children (python, awk) rather than the subshell wrapping them:
  # the subshell then exits on its own as the pipeline ends, so bash has no
  # killed job to announce.
  for p in "${pids[@]:-}"; do
    [ -n "$p" ] || continue
    pkill -P "$p" >/dev/null 2>&1 || true
  done
  quiet_wait
  # Anything that ignored the signal gets a harder nudge.
  for p in "${pids[@]:-}"; do
    [ -n "$p" ] || continue
    kill -9 "$p" >/dev/null 2>&1 || true
  done
}
trap cleanup EXIT INT TERM

# Prefix each process's output so one terminal stays readable.
# PYTHONUNBUFFERED and awk's fflush keep lines appearing as they happen.
run_prefixed() {
  local label="$1"; shift
  (
    PYTHONUNBUFFERED=1 "$@" 2>&1 | awk -v l="$label" '{ print l $0; fflush() }'
  ) &
  pids+=("$!")
}

# Bash announces killed background jobs ("Terminated: 15") when waiting, which
# is noise during a deliberate shutdown.
quiet_wait() { wait "$@" 2>/dev/null || true; }

printf '\033[1mrgboo dev\033[0m  '
$RUN_API && printf 'api :8080  '
$RUN_BRIDGE && printf 'bridge obs::%s  ' "$OBS_PORT"
$RUN_WEB && printf 'web :%s  ' "$WEB_PORT"
printf 'firestore :%s  ui :%s  ' "$FIRESTORE_PORT" "$FIREBASE_UI_PORT"
$DRY_RUN || printf '\033[31mREAL SERIAL\033[0m  '
printf '\n\033[2mWeb: http://127.0.0.1:%s  Admin: http://127.0.0.1:%s/admin  Firestore UI: http://127.0.0.1:%s\033[0m\n\033[2mCtrl-C to stop\033[0m\n\n' "$WEB_PORT" "$WEB_PORT" "$FIREBASE_UI_PORT"

firebase_args=(emulators:start --only firestore --project "$LOCAL_PROJECT_ID" --export-on-exit .firebase)
if [ -d .firebase ]; then
  firebase_args+=(--import .firebase)
fi
run_prefixed "$(printf '\033[33m[db]    \033[0m ')" firebase "${firebase_args[@]}"

# Starting the consumers only after the emulator is listening gives a clean
# failure instead of a confusing gRPC retry loop on first setup.
for _ in $(seq 1 60); do
  if port_busy "$FIRESTORE_PORT"; then
    break
  fi
  sleep 1
done
if ! port_busy "$FIRESTORE_PORT"; then
  printf 'Firestore emulator did not start on port %s. Check the [db] output above.\n' "$FIRESTORE_PORT" >&2
  exit 1
fi

if $RUN_API; then
  run_prefixed "$(printf '\033[36m[api]   \033[0m ')" "$PY" -m cloud_api.app
fi

if $RUN_BRIDGE; then
  bridge_args=(-m bridge.main --obs-port "$OBS_PORT")
  # Dry run is the default on purpose: without the ESP32 attached, opening the
  # serial port either fails or fights whatever else owns it.
  $DRY_RUN && bridge_args+=(--dry-run)
  run_prefixed "$(printf '\033[35m[bridge]\033[0m ')" "$PY" "${bridge_args[@]}"
fi

if $RUN_WEB; then
  run_prefixed "$(printf '\033[32m[web]   \033[0m ')" env RGBOO_API_KEY="$LOCAL_API_KEY" web/node_modules/.bin/vite web --host 127.0.0.1 --port "$WEB_PORT"
fi

quiet_wait
