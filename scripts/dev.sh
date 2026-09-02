#!/usr/bin/env bash
#
# Run the cloud API and the bridge together in one terminal.
# Ctrl-C stops both.
#
#   ./scripts/dev.sh                 API + bridge (dry run)
#   ./scripts/dev.sh --api-only      just the API
#   ./scripts/dev.sh --bridge-only   just the bridge
#   ./scripts/dev.sh --real-serial   drive actual hardware (see below)
#
# Settings come from .env. See docs/local-setup.md.

set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."

VENV=".venv"
PY="$VENV/bin/python"
OBS_PORT="${BRIDGE_OBS_PORT:-5077}"
RUN_API=true
RUN_BRIDGE=true
DRY_RUN=true

for arg in "$@"; do
  case "$arg" in
    --api-only)     RUN_BRIDGE=false ;;
    --bridge-only)  RUN_API=false ;;
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

# A port already in use usually means a previous run did not shut down, and the
# resulting error is much less obvious than saying so up front.
port_busy() { lsof -nP -iTCP:"$1" -sTCP:LISTEN >/dev/null 2>&1; }

if $RUN_API && port_busy 8080; then
  printf 'Port 8080 is already in use — is another API still running?\n' >&2
  exit 1
fi
if $RUN_BRIDGE && port_busy "$OBS_PORT"; then
  printf 'Port %s is in use. Set BRIDGE_OBS_PORT to something else.\n' "$OBS_PORT" >&2
  exit 1
fi

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
$DRY_RUN || printf '\033[31mREAL SERIAL\033[0m  '
printf '\n\033[2mCtrl-C to stop\033[0m\n\n'

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

quiet_wait
