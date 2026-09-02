# bridge

The half of RGBoo that cannot live in the cloud. It watches Firestore for
pending color requests, waits for each one's slot, and writes the color to
the ESP32 over USB serial. See `docs/gcp-migration-plan.md` for the full
design; this is the how-to-run.

```
Cloud Run API --> Firestore --> bridge (this machine) --> USB serial --> ESP32
```

It also serves the OBS browser source on `:5001`, reusing
`middleware/obs.py` and its template unchanged, so the OBS scene needs no
edits at cutover.

## Install

Run everything from the **repo root** -- the daemon imports `shared/` and
`middleware/` as siblings.

```
python -m venv .venv && source .venv/bin/activate
pip install -r bridge/requirements.txt
```

## Credentials

Firestore auth uses the `rgboo-bridge` service-account key (created in
Phase 4 of the migration plan, with `roles/datastore.user`):

```
export GOOGLE_APPLICATION_CREDENTIALS=/etc/rgboo/bridge-sa-key.json
```

Keep the key off the repo; `chmod 600` it and give it to the daemon's user
only.

## Dry run

`--dry-run` logs color writes instead of opening the serial port, so it is
safe to run while the old middleware still owns the ESP32 -- that is how
Phase 4 tests the cloud path in parallel with live traffic.

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
- **`processor.py`** is the dispatch loop, ported from
  `middleware/color_queue.py:82-138`. It re-reads each doc immediately
  before the serial write, which is how `POST /admin/queue/clear` actually
  stops the LEDs changing.
- **`listener.py`** feeds the processor, either from an `on_snapshot`
  stream (outbound gRPC, so no inbound port or NAT config) or by polling.
  Even in listener mode a slow poll runs as a safety net for a stream
  that dies quietly.
- **`heartbeat.py`** writes `meta/bridge` every 60s; the cloud API reads
  it to answer `bridge_online` / `serial_connected`.

## Tests

No GCP credentials or hardware needed -- Firestore and the serial port
are mocked:

```
pip install pytest
pytest bridge/tests -q
```
