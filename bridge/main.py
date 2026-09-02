"""Bridge daemon entrypoint.

    python -m bridge.main --dry-run     # safe: logs instead of writing serial
    python -m bridge.main               # owns the USB port

Run from the repo root so the `bridge`, `shared`, and `middleware`
packages all resolve. Firestore auth comes from the service-account key
pointed at by GOOGLE_APPLICATION_CREDENTIALS.
"""

import argparse
import logging
import os
import signal
import sys

from .config import Config
from .dry_run import DryRunSerialController
from .heartbeat import HeartbeatWriter
from .listener import OverlayControlWatcher, PendingPoller, PendingWatcher
from .obs_server import create_obs_app, make_obs_callback, start_obs_server
from .overlay_control import OverlayController
from .processor import ColorProcessor
from .store import BridgeStore
from shared.firestore_client import get_firestore_client

logger = logging.getLogger(__name__)


def parse_args(argv=None):
    parser = argparse.ArgumentParser(description="RGBoo Firestore -> USB serial bridge")
    parser.add_argument(
        '--dry-run',
        action='store_true',
        help="Log color writes instead of opening the serial port. Use while "
             "the old middleware still owns the ESP32.",
    )
    parser.add_argument(
        '--poll',
        action='store_true',
        help="Poll Firestore instead of using the on_snapshot listener.",
    )
    parser.add_argument(
        '--poll-interval',
        type=float,
        default=Config.POLL_INTERVAL_SECONDS,
        help=f"Seconds between polls in --poll mode (default {Config.POLL_INTERVAL_SECONDS}).",
    )
    parser.add_argument(
        '--serial-port',
        default=Config.SERIAL_PORT,
        help="Serial device to use; omit to auto-detect the ESP32 by VID/PID.",
    )
    parser.add_argument('--obs-host', default=Config.OBS_HOST)
    parser.add_argument('--obs-port', type=int, default=Config.OBS_PORT)
    parser.add_argument(
        '--no-obs',
        action='store_true',
        help="Skip the embedded OBS browser-source server.",
    )
    parser.add_argument('--log-level', default=Config.LOG_LEVEL)
    return parser.parse_args(argv)


def build_serial_controller(args):
    """Real serial controller, or the logging stand-in in --dry-run."""
    if args.dry_run:
        logger.warning("DRY RUN: serial port will not be opened")
        return DryRunSerialController()

    # Imported lazily so --dry-run works on a machine without pyserial's
    # device access (or without pyserial at all).
    from middleware.serial_controller import SerialController

    controller = SerialController()
    if controller.connect(args.serial_port):
        logger.info("Successfully connected to ESP32")
    else:
        logger.warning(
            "Could not connect to ESP32 on startup - will retry on first color"
        )
    return controller


def main(argv=None) -> int:
    args = parse_args(argv)

    logging.basicConfig(
        level=getattr(logging, args.log_level.upper(), logging.INFO),
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    )

    if not os.getenv('GOOGLE_APPLICATION_CREDENTIALS') and not os.getenv('FIRESTORE_EMULATOR_HOST'):
        # Not fatal -- gcloud application-default credentials work too --
        # but on the home machine it is almost always the missing piece.
        logger.warning(
            "GOOGLE_APPLICATION_CREDENTIALS is not set; falling back to "
            "application default credentials"
        )

    store = BridgeStore(get_firestore_client())
    serial_controller = build_serial_controller(args)

    obs_callback = None
    if not args.no_obs:
        app, socketio = create_obs_app(Config.OBS_SECRET_KEY)
        obs_callback = make_obs_callback(socketio)
        start_obs_server(app, socketio, args.obs_host, args.obs_port)

    processor = ColorProcessor(store, serial_controller, obs_callback)

    # Admin clears arrive as a doc; primed so none is replayed at boot.
    overlay_controller = OverlayController(store, obs_callback)
    overlay_controller.prime()

    # The poller is a slow safety net for a dead stream, overlay doc included.
    watcher = None
    overlay_watcher = None
    if args.poll:
        poller = PendingPoller(store, processor, args.poll_interval, overlay_controller)
    else:
        watcher = PendingWatcher(store, processor)
        watcher.start()
        overlay_watcher = OverlayControlWatcher(store, overlay_controller)
        overlay_watcher.start()
        poller = PendingPoller(
            store, processor, Config.RESYNC_INTERVAL_SECONDS, overlay_controller
        )
    poller.start()

    heartbeat = HeartbeatWriter(store, serial_controller, Config.HEARTBEAT_SECONDS)
    heartbeat.start()

    def shutdown(signum, _frame):
        logger.info(f"Received signal {signum}, shutting down")
        processor.stop()

    try:
        signal.signal(signal.SIGTERM, shutdown)
        signal.signal(signal.SIGINT, shutdown)
    except ValueError:
        # Only the main thread can install handlers; running the daemon
        # from a worker thread (tests, embedding) just loses graceful
        # shutdown, which is not worth refusing to start over.
        logger.warning("Not on the main thread; signal handlers not installed")

    try:
        # Blocks on the main thread until stop(); everything else above
        # runs on daemon threads.
        processor.run()
    finally:
        heartbeat.stop()
        poller.stop()
        if watcher is not None:
            watcher.stop()
        if overlay_watcher is not None:
            overlay_watcher.stop()
        if not args.dry_run:
            serial_controller.disconnect()

    return 0


if __name__ == '__main__':
    sys.exit(main())
