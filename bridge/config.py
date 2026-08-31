import os


class Config:
    """Configuration for the bridge daemon, read from environment variables.

    Every value is also overridable by a command-line flag in main.py;
    the environment is what the systemd unit uses.
    """

    # Embedded OBS browser-source server. Defaults match the old
    # middleware (middleware/firmware_config.py) so the OBS scene's
    # existing http://127.0.0.1:5001/obs URL keeps working.
    OBS_HOST = os.getenv('BRIDGE_OBS_HOST', '127.0.0.1')
    OBS_PORT = int(os.getenv('BRIDGE_OBS_PORT', 5001))
    OBS_SECRET_KEY = os.getenv('BRIDGE_OBS_SECRET_KEY', 'obs-websocket-secret')

    # Optional explicit serial device; empty means auto-detect by VID/PID.
    SERIAL_PORT = os.getenv('BRIDGE_SERIAL_PORT') or None

    # Heartbeat cadence. shared.schema.BRIDGE_STALE_SECONDS (120) is the
    # window the cloud API uses to call the bridge offline, so this must
    # stay comfortably below it.
    HEARTBEAT_SECONDS = int(os.getenv('BRIDGE_HEARTBEAT_SECONDS', 60))

    # How often the poll fallback (--poll) re-lists pending requests.
    POLL_INTERVAL_SECONDS = int(os.getenv('BRIDGE_POLL_INTERVAL_SECONDS', 15))

    # In listener mode a slow poll still runs as a safety net, in case the
    # on_snapshot stream dies quietly (NAT/idle timeouts). Cheap: a few
    # reads every 5 minutes is nothing against the free-tier daily quota.
    RESYNC_INTERVAL_SECONDS = int(os.getenv('BRIDGE_RESYNC_INTERVAL_SECONDS', 300))

    LOG_LEVEL = os.getenv('BRIDGE_LOG_LEVEL', 'INFO')
