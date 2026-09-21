# bridge

The half of RGBoo that cannot live in the cloud. It watches Firestore for
pending color requests, waits for each one's slot, and writes the color to
the ESP32 over USB serial. See [`docs/architecture.md`](../docs/architecture.md)
for the full design; this is the how-to-run.

```
Cloud Run API --> Firestore --> bridge (this machine) --> USB serial --> ESP32
```

It also serves the OBS browser source on `:5001` from `obs.py` and
`templates/`, at the `http://127.0.0.1:5001/obs` URL the OBS scene
already points at.

On Windows it also listens to the system media session and POSTs each track
change to Cloudflare, which broadcasts it from `https://rgboo.com/api/stream`.

New here? [`docs/local-setup.md`](../docs/local-setup.md) starts the complete
emulator-backed stack and runs this bridge in dry-run mode, which is what you
want unless the ESP32 is plugged into your machine.

## Install

Run everything from the **repo root** -- the daemon imports `shared/` as
a sibling.

```
python -m venv .venv && source .venv/bin/activate
pip install -r bridge/requirements.txt
```

On the Windows bridge machine, set the push secret to the same value uploaded
to the Cloudflare Worker with `wrangler secret put PUSH_SECRET`:

```powershell
$env:BRIDGE_PUSH_SECRET = "the-shared-secret"
```

The destination defaults to `https://rgboo.com/api/update-song`; override it
with `BRIDGE_NOW_PLAYING_URL`. Use `--no-now-playing` to disable the listener.

## Credentials

Firestore auth uses the `rgboo-bridge` service-account key
(`roles/datastore.user`):

```
export GOOGLE_APPLICATION_CREDENTIALS=/etc/rgboo/bridge-sa-key.json
```

Keep the key off the repo; `chmod 600` it and give it to the daemon's user
only.

## Dry run

`--dry-run` logs color writes instead of opening the serial port, so it
runs anywhere -- no ESP32 attached, and no fight over the port with a
bridge that is already running.

```
python -m bridge.main --dry-run
```

You should see the heartbeat land in `meta/bridge` (the cloud API's
`GET /` starts reporting `bridge_online: true`), and any pending request
dispatched at its `scheduled_time` and marked `done`. In dry run the
heartbeat reports `serial_connected: false`, since no port is open.

## Real run

```
python -m bridge.main
```

The port is auto-detected by VID/PID; override with `--serial-port
/dev/ttyUSB0` or `BRIDGE_SERIAL_PORT`. The user needs to be in the
`dialout` group to open the device.

Useful flags: `--poll` (poll Firestore instead of the snapshot listener),
`--poll-interval`, `--obs-host` / `--obs-port`, `--no-obs`, `--log-level`.
Every flag has an environment equivalent in `bridge/config.py`.

## Run under systemd

```
sudo cp bridge/rgboo-bridge.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now rgboo-bridge
journalctl -u rgboo-bridge -f
```

Edit `User`, `WorkingDirectory` (the repo root) and `ExecStart` (the venv
python) in the unit to match the machine. `Restart=always` plus durable
Firestore state means a crash or reboot resumes the queue instead of
losing it -- the main durability win over the old in-memory queue.

## Updating a running bridge

There is no deploy button for the bridge -- it lives behind home NAT, so
nothing can push to it. Pull, on that machine:

```
cd /opt/rgboo && git pull
.venv/bin/pip install -r bridge/requirements.txt   # only if requirements changed
sudo systemctl restart rgboo-bridge
journalctl -u rgboo-bridge -f
```

Restarting mid-queue is safe: pending requests live in Firestore, so the
bridge picks them back up (overdue ones dispatch immediately). See
`docs/deploying.md` for rollback.

## How it works

- **`main.py`** wires everything together and owns shutdown.
- **`store.py`** is the only module that knows Firestore.
- **`processor.py`** is the dispatch loop. It re-reads each doc immediately
  before the serial write, which is how `POST /admin/queue/clear` actually
  stops the LEDs changing.
- **`listener.py`** feeds the processor, either from an `on_snapshot`
  stream (outbound gRPC, so no inbound port or NAT config) or by polling.
  Even in listener mode a slow poll runs as a safety net for a stream
  that dies quietly.
- **`heartbeat.py`** writes `meta/bridge` every 60s; the cloud API reads
  it to answer `bridge_online` / `serial_connected`.
- **`now_playing.py`** listens for Windows media/session changes and pushes
  artist/title JSON to the Cloudflare SSE fan-out. One worker coalesces media
  events into a single pending refresh, including while a read or POST is slow.
- **`display.py`** publishes the current color/username with one in-flight POST
  and at most one waiting update. New updates replace the waiting value, so a
  slow endpoint cannot accumulate obsolete display states. Shutdown discards
  the waiting update. LED dispatch still processes each queued request.

## Tests

No GCP credentials or hardware needed -- Firestore and the serial port
are mocked:

```
pip install pytest
pytest bridge/tests -q
```
