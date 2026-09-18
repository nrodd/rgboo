import asyncio
import json
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
