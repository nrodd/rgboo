"""Publish Windows' current media session to the Cloudflare SSE fan-out.

Windows raises media/session change events; this component turns those events
into JSON POSTs.  It runs its own asyncio loop because the rest of the bridge
is synchronous and blocks on the color processor.
"""

import asyncio
import json
import logging
import sys
import threading
from typing import Callable, Optional
from urllib.request import Request, urlopen

logger = logging.getLogger(__name__)


def post_song(url: str, push_secret: Optional[str], song: dict) -> None:
    """POST one song update, raising when Cloudflare rejects the request."""
    headers = {
        'Content-Type': 'application/json',
        # Cloudflare rejects urllib's default Python-urllib/* signature with
        # edge error 1010 before the request can reach the Worker.
        'User-Agent': 'rgboo-bridge/1.0',
    }
    if push_secret:
        headers['X-Push-Secret'] = push_secret

    request = Request(
        url,
        data=json.dumps(song).encode('utf-8'),
        headers=headers,
        method='POST',
    )
    with urlopen(request, timeout=10) as response:
        if not 200 <= response.status < 300:
            raise RuntimeError(f"now-playing endpoint returned HTTP {response.status}")


class NowPlayingPublisher:
    """Listen for Windows media changes and publish them in the background."""

    def __init__(
        self,
        url: str,
        push_secret: Optional[str] = None,
        poster: Callable[[str, Optional[str], dict], None] = post_song,
    ):
        self._url = url
        self._push_secret = push_secret
        self._poster = poster
        self._thread: Optional[threading.Thread] = None
        self._stop_requested = threading.Event()
        self._loop: Optional[asyncio.AbstractEventLoop] = None
        self._stop_event: Optional[asyncio.Event] = None
        self._refresh_event: Optional[asyncio.Event] = None
        self._schedule_lock = threading.Lock()
        self._wake_pending = False
        self._manager = None
        self._manager_token = None
        self._session = None
        self._session_token = None
        self._last_song = None
        self._publish_lock: Optional[asyncio.Lock] = None

    def start(self) -> None:
        if sys.platform != 'win32':
            logger.info("Now-playing publisher skipped (Windows only)")
            return
        if self._thread is not None or self._stop_requested.is_set():
            return
        self._thread = threading.Thread(
            target=self._run,
            name='now-playing',
            daemon=True,
        )
        self._thread.start()

    def stop(self) -> None:
        self._stop_requested.set()
        with self._schedule_lock:
            if self._loop is not None and self._stop_event is not None:
                self._loop.call_soon_threadsafe(self._stop_event.set)
        if self._thread is not None:
            self._thread.join(timeout=5)

    def _run(self) -> None:
        try:
            asyncio.run(self._listen())
        except ImportError:
            logger.error(
                "Now-playing publisher needs the Windows 'winsdk' package; "
                "install bridge/requirements.txt"
            )
        except Exception:
            logger.exception("Now-playing publisher stopped unexpectedly")

    async def _listen(self) -> None:
        # Kept inside the Windows-only thread so importing bridge.main remains
        # portable and all existing Linux/dev bridge workflows keep working.
        from winsdk.windows.media.control import (
            GlobalSystemMediaTransportControlsSessionManager as Manager,
        )

        worker = None
        self._stop_event = asyncio.Event()
        self._refresh_event = asyncio.Event()
        with self._schedule_lock:
            self._loop = asyncio.get_running_loop()
        try:
            if self._stop_requested.is_set():
                return
            self._manager = await Manager.request_async()
            self._manager_token = self._manager.add_current_session_changed(
                self._on_current_session_changed
            )
            worker = asyncio.create_task(self._refresh_loop())
            self._request_refresh()
            logger.info("Listening for Windows now-playing changes")
            await self._stop_event.wait()
        finally:
            # Reject late WinRT callbacks before the asyncio loop closes.
            with self._schedule_lock:
                self._loop = None
                self._wake_pending = False
            if worker is not None:
                worker.cancel()
                await asyncio.gather(worker, return_exceptions=True)
            try:
                self._unbind_session()
            finally:
                try:
                    if self._manager is not None and self._manager_token is not None:
                        self._manager.remove_current_session_changed(self._manager_token)
                finally:
                    self._manager = None
                    self._manager_token = None

    def _request_refresh(self) -> None:
        """Coalesce before scheduling, including callbacks on native threads.

        One worker reads the current session; events retain no media objects.
        At most one wakeup waits behind an in-flight media read or POST.
        """
        with self._schedule_lock:
            if (self._loop is None or self._stop_requested.is_set()
                    or self._wake_pending):
                return
            self._wake_pending = True
            self._loop.call_soon_threadsafe(self._refresh_event.set)

    def _on_current_session_changed(self, _sender, _args) -> None:
        self._request_refresh()

    def _on_media_properties_changed(self, _sender, _args) -> None:
        self._request_refresh()

    async def _refresh_loop(self) -> None:
        while True:
            await self._refresh_event.wait()
            self._refresh_event.clear()
            with self._schedule_lock:
                self._wake_pending = False
            try:
                await self._bind_current_session()
            except Exception:
                logger.exception("Failed to refresh Windows media session")

    async def _bind_current_session(self) -> None:
        session = self._manager.get_current_session()
        if session != self._session:
            self._unbind_session()
            self._session = session
        if self._session is None:
            logger.info("No active Windows media session")
            await self._publish_song({'artist': '', 'title': ''})
            return

        if self._session_token is None:
            self._session_token = self._session.add_media_properties_changed(
                self._on_media_properties_changed
            )
        # Publish immediately at startup/session switch; do not wait for the
        # next track change to populate a newly connected SSE subscriber.
        await self._publish_session(self._session)

    def _unbind_session(self) -> None:
        session, token = self._session, self._session_token
        self._session = None
        self._session_token = None
        if session is not None and token is not None:
            session.remove_media_properties_changed(token)

    async def _publish_session(self, session) -> None:
        try:
            info = await session.try_get_media_properties_async()
            song = {
                'artist': info.artist or '',
                'title': info.title or '',
            }
            await self._publish_song(song)
        except Exception as error:
            # A media API or network failure must never stop color dispatch.
            logger.error("Failed to publish now-playing update: %s", error)

    async def _publish_song(self, song: dict) -> None:
        # Windows can emit the same media change more than once in quick
        # succession. Keep the comparison and POST in one critical section so
        # concurrent handler tasks cannot both observe the old _last_song.
        if self._publish_lock is None:
            self._publish_lock = asyncio.Lock()

        async with self._publish_lock:
            if song == self._last_song:
                return
            try:
                await asyncio.to_thread(
                    self._poster, self._url, self._push_secret, song
                )
                self._last_song = song
                logger.info("Now playing: %s - %s", song['artist'], song['title'])
            except Exception as error:
                # Keep the last successfully sent value, so a later duplicate
                # event gets another chance after a transient network failure.
                logger.error("Failed to publish now-playing update: %s", error)
