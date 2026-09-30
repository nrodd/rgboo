import asyncio
import json
import time
import threading

import pytest
from unittest.mock import Mock, patch

from ..now_playing import NowPlayingPublisher, post_song


class MediaInfo:
    artist = 'Daft Punk'
    title = 'One More Time'


class Session:
    async def try_get_media_properties_async(self):
        return MediaInfo()


def test_publish_sends_artist_and_title():
    poster = Mock()
    publisher = NowPlayingPublisher(
        'https://example.com/api/update-song', 'secret', poster
    )

    asyncio.run(publisher._publish_session(Session()))

    poster.assert_called_once_with(
        'https://example.com/api/update-song',
        'secret',
        {'artist': 'Daft Punk', 'title': 'One More Time'},
    )


def test_duplicate_media_event_is_not_posted_twice():
    poster = Mock()
    publisher = NowPlayingPublisher('https://example.com', None, poster)

    async def publish_twice():
        await publisher._publish_session(Session())
        await publisher._publish_session(Session())

    asyncio.run(publish_twice())

    poster.assert_called_once()


def test_concurrent_duplicate_events_are_not_posted_twice():
    poster = Mock(side_effect=lambda *_args: time.sleep(0.05))
    publisher = NowPlayingPublisher('https://example.com', None, poster)

    async def publish_concurrently():
        await asyncio.gather(
            publisher._publish_session(Session()),
            publisher._publish_session(Session()),
        )

    asyncio.run(publish_concurrently())

    poster.assert_called_once()


def test_post_song_uses_json_and_push_secret():
    response = Mock()
    response.status = 200
    response.__enter__ = Mock(return_value=response)
    response.__exit__ = Mock(return_value=False)

    with patch('bridge.now_playing.urlopen', return_value=response) as open_url:
        post_song(
            'https://example.com/api/update-song',
            'secret',
            {'artist': 'Artist', 'title': 'Title'},
        )

    request = open_url.call_args.args[0]
    assert request.method == 'POST'
    assert json.loads(request.data) == {'artist': 'Artist', 'title': 'Title'}
    assert request.get_header('Content-type') == 'application/json'
    assert request.get_header('User-agent') == 'rgboo-bridge/1.0'
    assert request.get_header('X-push-secret') == 'secret'


class WatchedSession:
    def __init__(self, title, entered=None, release=None):
        self.title = title
        self.entered = entered
        self.release = release
        self.add_media_properties_changed = Mock(return_value=1)
        self.remove_media_properties_changed = Mock()

    async def try_get_media_properties_async(self):
        if self.entered is not None:
            self.entered.set()
            await self.release.wait()
        info = MediaInfo()
        info.title = self.title
        return info


def fake_winrt(manager):
    from types import SimpleNamespace
    from unittest.mock import AsyncMock
    return patch.dict('sys.modules', {
        'winsdk.windows.media.control': SimpleNamespace(
            GlobalSystemMediaTransportControlsSessionManager=SimpleNamespace(
                request_async=AsyncMock(return_value=manager)
            )
        )
    })


def test_media_burst_has_one_wakeup_and_publishes_latest_session():
    async def run():
        entered, release, latest_sent = asyncio.Event(), asyncio.Event(), asyncio.Event()
        loop = asyncio.get_running_loop()
        calls = []

        def poster(_url, _secret, song):
            calls.append(song['title'])
            if song['title'] == 'latest':
                loop.call_soon_threadsafe(latest_sent.set)

        first = WatchedSession('first', entered, release)
        latest = WatchedSession('latest')
        manager = Mock()
        manager.get_current_session.return_value = first
        publisher = NowPlayingPublisher('unused', poster=poster)
        with fake_winrt(manager):
            listener = asyncio.create_task(publisher._listen())
            try:
                await asyncio.wait_for(entered.wait(), 2)
                tasks_before = len(asyncio.all_tasks())
                # Run native-style callbacks off-loop. No callback may retain
                # its sender or schedule a task per event, even during a stall.
                def burst():
                    for _ in range(20000):
                        publisher._on_media_properties_changed(first, None)
                        publisher._on_current_session_changed(None, None)
                with patch.object(loop, 'call_soon_threadsafe', wraps=loop.call_soon_threadsafe) as schedule:
                    await asyncio.to_thread(burst)
                    wakeups = [call for call in schedule.call_args_list
                               if call.args[0] == publisher._refresh_event.set]
                    assert len(wakeups) == 1
                assert len(asyncio.all_tasks()) == tasks_before
                manager.get_current_session.return_value = latest
                release.set()
                await asyncio.wait_for(latest_sent.wait(), 2)
                assert calls == ['first', 'latest']
            finally:
                publisher.stop()
                await asyncio.wait_for(listener, 2)
            first.remove_media_properties_changed.assert_called_once_with(1)
            latest.remove_media_properties_changed.assert_called_once_with(1)
            manager.remove_current_session_changed.assert_called_once_with(
                manager.add_current_session_changed.return_value
            )
            # Late callbacks after cleanup are ignored, including after stop.
            publisher._on_media_properties_changed(first, None)
            assert publisher._loop is None
            assert publisher._session is None
            assert publisher._manager is None
    asyncio.run(run())


def test_cancellation_cleans_handlers_even_if_session_removal_fails():
    async def run():
        entered, release = asyncio.Event(), asyncio.Event()
        session = WatchedSession('first', entered, release)
        session.remove_media_properties_changed.side_effect = RuntimeError('remove failed')
        manager = Mock()
        manager.get_current_session.return_value = session
        publisher = NowPlayingPublisher('unused', poster=Mock())
        with fake_winrt(manager):
            listener = asyncio.create_task(publisher._listen())
            await asyncio.wait_for(entered.wait(), 2)
            listener.cancel()
            with pytest.raises(RuntimeError, match='remove failed'):
                await listener
        manager.remove_current_session_changed.assert_called_once()
        assert publisher._manager is None
        assert publisher._session is None
        assert publisher._loop is None
        assert len(asyncio.all_tasks()) == 1
    asyncio.run(run())


def test_failed_slow_post_coalesces_burst_into_one_retry():
    async def run():
        entered, retried = asyncio.Event(), asyncio.Event()
        release = threading.Event()
        loop = asyncio.get_running_loop()
        calls = []

        def poster(_url, _secret, song):
            calls.append(song)
            if len(calls) == 1:
                loop.call_soon_threadsafe(entered.set)
                assert release.wait(5)
                raise RuntimeError('endpoint unavailable')
            loop.call_soon_threadsafe(retried.set)

        session = WatchedSession('same song')
        manager = Mock()
        manager.get_current_session.return_value = session
        publisher = NowPlayingPublisher('unused', poster=poster)
        with fake_winrt(manager):
            listener = asyncio.create_task(publisher._listen())
            try:
                await asyncio.wait_for(entered.wait(), 2)
                for _ in range(20000):
                    publisher._on_media_properties_changed(session, None)
                release.set()
                await asyncio.wait_for(retried.wait(), 2)
            finally:
                release.set()
                publisher.stop()
                await asyncio.wait_for(listener, 2)
        assert len(calls) == 2
        assert calls[0] == calls[1]
        session.add_media_properties_changed.assert_called_once()
        session.remove_media_properties_changed.assert_called_once()
    asyncio.run(run())
