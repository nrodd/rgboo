import asyncio
import json
from dataclasses import replace
from unittest.mock import AsyncMock

import aiohttp
import pytest

from stream_aggregator.colors import parse_color
from stream_aggregator.config import Config
from stream_aggregator.forwarder import Forwarder
from stream_aggregator.http import APIError
from stream_aggregator.twitch import Twitch
from stream_aggregator.youtube import YouTube


CONFIG = Config("https://cloud.example", "secret", youtube_key="google-key", youtube_video="video")


@pytest.mark.parametrize("text,rgb", [
    ("!red", (255, 0, 0)), ("!BLUE", (0, 0, 255)), (" !teal \n", (0, 128, 128)),
    ("!#a0B1c2", (160, 177, 194)), ("!abc", (170, 187, 204)),
    ("!#0f0", (0, 255, 0)), ("!00ffcc", (0, 255, 204)),
    ("!rebeccapurple", (102, 51, 153)), ("!darkslategray", (47, 79, 79)),
])
def test_valid_commands(text, rgb):
    assert parse_color(text) == dict(zip(("r", "g", "b"), rgb))


@pytest.mark.parametrize("text", [
    "red", "hello !red", "!red please", "!!red", "! red", "!red\n!blue",
    "!#12345", "!#12345678", "!transparent", "!rgb(1,2,3)", "!unknown", "!", "!🟥",
])
def test_ignored_messages(text):
    assert parse_color(text) is None


def test_config(monkeypatch):
    for key in list(__import__("os").environ):
        if key.startswith(("CLOUD_API_", "YOUTUBE_", "TWITCH_")):
            monkeypatch.delenv(key)
    with pytest.raises(ValueError):
        Config.from_env()
    monkeypatch.setenv("CLOUD_API_URL", "https://cloud.example")
    monkeypatch.setenv("CLOUD_API_KEY", "secret")
    with pytest.raises(ValueError, match="Configure"):
        Config.from_env()
    monkeypatch.setenv("YOUTUBE_VIDEO_ID", "video")
    with pytest.raises(ValueError, match="YOUTUBE_API_KEY"):
        Config.from_env()
    monkeypatch.setenv("YOUTUBE_API_KEY", "key")
    assert Config.from_env().youtube_video == "video"


def test_forwarder_filters_deduplicates_and_sends_contract(monkeypatch):
    async def scenario():
        post = AsyncMock(return_value={"status": "queued"})
        monkeypatch.setattr("stream_aggregator.forwarder.request", post)
        forwarder = Forwarder(object(), CONFIG)
        forwarder.submit("youtube", "1", "Alice", "hello")
        forwarder.submit("youtube", "2", "Alice", "!teal")
        forwarder.submit("youtube", "2", "Alice", "!teal")
        forwarder.submit("twitch", "2", "Bob", "!#f00")
        worker = asyncio.create_task(forwarder.run())
        await asyncio.wait_for(forwarder.queue.join(), 1)
        worker.cancel()
        await asyncio.gather(worker, return_exceptions=True)
        assert post.await_count == 2
        call = post.call_args_list[0]
        assert call.args[1:] == ("POST", "https://cloud.example/api/color")
        assert call.kwargs == {"headers": {"X-Api-Key": "secret"},
                               "json": {"username": "Alice", "color": {"r": 0, "g": 128, "b": 128}}}
    asyncio.run(scenario())


@pytest.mark.parametrize("error", [APIError(400), APIError(500), asyncio.TimeoutError(), aiohttp.ClientError()])
def test_delivery_errors_are_not_retried(monkeypatch, error):
    async def scenario():
        post = AsyncMock(side_effect=error)
        monkeypatch.setattr("stream_aggregator.forwarder.request", post)
        forwarder = Forwarder(object(), CONFIG)
        forwarder.submit("twitch", "1", "Alice", "!blue")
        worker = asyncio.create_task(forwarder.run())
        await asyncio.wait_for(forwarder.queue.join(), 1)
        worker.cancel()
        await asyncio.gather(worker, return_exceptions=True)
        assert post.await_count == 1
    asyncio.run(scenario())


def test_cloud_auth_failure_is_fatal(monkeypatch):
    async def scenario():
        monkeypatch.setattr("stream_aggregator.forwarder.request", AsyncMock(side_effect=APIError(401)))
        forwarder = Forwarder(object(), CONFIG)
        forwarder.submit("twitch", "1", "Alice", "!blue")
        with pytest.raises(RuntimeError, match="credentials"):
            await forwarder.run()
    asyncio.run(scenario())


def test_queue_is_bounded():
    async def scenario():
        forwarder = Forwarder(None, CONFIG, capacity=1)
        forwarder.submit("twitch", "1", "Alice", "!blue")
        forwarder.submit("twitch", "2", "Alice", "!red")
        assert forwarder.queue.qsize() == 1
    asyncio.run(scenario())


def youtube_message(identifier, text="!red", kind="textMessageEvent"):
    return {"id": identifier, "authorDetails": {"displayName": "Alice"},
            "snippet": {"type": kind, "textMessageDetails": {"messageText": text}}}


def test_youtube_history_cursor_interval_and_end():
    async def scenario():
        forwarder = Forwarder(None, CONFIG)
        youtube = YouTube(None, CONFIG, forwarder)
        youtube.get = AsyncMock(side_effect=[
            {"items": [{"liveStreamingDetails": {"activeLiveChatId": "chat"}}]},
            {"items": [youtube_message("old")], "nextPageToken": "page2", "pollingIntervalMillis": 7000},
            {"items": [youtube_message("new"), youtube_message("other", kind="superChatEvent")],
             "nextPageToken": "page3", "pollingIntervalMillis": 9000},
            {"items": [], "offlineAt": "ended"},
        ])
        assert await youtube.poll() == 7
        assert forwarder.queue.empty()
        assert await youtube.poll() == 9
        assert youtube.get.call_args.kwargs["pageToken"] == "page2"
        assert forwarder.queue.qsize() == 1
        assert await youtube.poll() is None
    asyncio.run(scenario())


def test_youtube_waits_for_scheduled_video():
    async def scenario():
        youtube = YouTube(None, CONFIG, None)
        youtube.get = AsyncMock(return_value={"items": []})
        assert await youtube.poll() == 60
    asyncio.run(scenario())


def twitch_config(**kwargs):
    return replace(CONFIG, twitch_client="client", twitch_user="123", twitch_channel="456",
                   twitch_token="token", **kwargs)


def twitch_message(kind, payload):
    return {"metadata": {"message_type": kind}, "payload": payload}


def notification():
    return twitch_message("notification", {
        "subscription": {"type": "channel.chat.message"},
        "event": {"broadcaster_user_id": "456", "chatter_user_name": "Bob", "message_id": "message",
                  "message": {"text": "!blue"}},
    })


def test_twitch_subscription_contract(monkeypatch):
    async def scenario():
        post = AsyncMock(return_value={})
        monkeypatch.setattr("stream_aggregator.twitch.request", post)
        twitch = Twitch(None, twitch_config(), None)
        await twitch.subscribe("session")
        assert post.call_args.kwargs["json"] == {
            "type": "channel.chat.message", "version": "1",
            "condition": {"broadcaster_user_id": "456", "user_id": "123"},
            "transport": {"method": "websocket", "session_id": "session"},
        }
    asyncio.run(scenario())


def test_twitch_notifications_and_wrong_channel():
    async def scenario():
        forwarder = Forwarder(None, CONFIG)
        twitch = Twitch(None, twitch_config(), forwarder)
        message = notification()
        twitch.notification(message)
        twitch.notification(message)
        message["payload"]["event"]["broadcaster_user_id"] = "999"
        twitch.notification(message)
        assert forwarder.queue.qsize() == 1
    asyncio.run(scenario())


def test_twitch_expired_token_refreshes_and_persists(monkeypatch, tmp_path):
    async def scenario():
        path = tmp_path / "tokens.json"
        post = AsyncMock(side_effect=[APIError(401), {"access_token": "new", "refresh_token": "rotated"},
                                     {"client_id": "client", "user_id": "123", "scopes": ["user:read:chat"],
                                      "expires_in": 10000}])
        monkeypatch.setattr("stream_aggregator.twitch.request", post)
        config = twitch_config(twitch_refresh="refresh", twitch_secret="secret", twitch_token_file=str(path))
        twitch = Twitch(None, config, None)
        assert await twitch.validate() == 3600
        assert json.loads(path.read_text())["refresh_token"] == "rotated"
        assert path.stat().st_mode & 0o777 == 0o600
        assert Twitch(None, config, None).token == "new"
    asyncio.run(scenario())


def test_twitch_wrong_scope_is_fatal(monkeypatch):
    async def scenario():
        monkeypatch.setattr("stream_aggregator.twitch.request", AsyncMock(return_value={
            "client_id": "client", "user_id": "123", "scopes": []}))
        with pytest.raises(RuntimeError, match="user:read:chat"):
            await Twitch(None, twitch_config(), None).validate()
    asyncio.run(scenario())


def test_twitch_reconnect_does_not_resubscribe():
    class Socket:
        def __init__(self, messages):
            self.messages = list(messages)
            self.closed = False

        async def receive_json(self, **kwargs):
            if self.messages:
                return self.messages.pop(0)
            await asyncio.Event().wait()

        async def close(self):
            self.closed = True

    async def scenario():
        forwarder = Forwarder(None, CONFIG)
        twitch = Twitch(None, twitch_config(), forwarder)
        old = Socket([twitch_message("session_reconnect", {"session": {"reconnect_url": "wss://replacement"}}),
                      notification()])
        new = Socket([notification(), twitch_message("revocation", {})])
        twitch.open_socket = AsyncMock(side_effect=[(old, {"id": "first", "keepalive_timeout_seconds": 10}),
                                                    (new, {"id": "replacement", "keepalive_timeout_seconds": 10})])
        twitch.subscribe = AsyncMock()
        with pytest.raises(RuntimeError, match="revoked"):
            await asyncio.wait_for(twitch.listen(), 1)
        twitch.subscribe.assert_awaited_once_with("first")
        assert old.closed and new.closed
        assert forwarder.queue.qsize() == 1
    asyncio.run(scenario())


def test_real_http_delivery_to_local_api():
    from aiohttp import web

    async def scenario():
        received = []

        async def color(request):
            received.append((request.headers.get("X-Api-Key"), await request.json()))
            return web.json_response({"status": "queued"})

        app = web.Application()
        app.router.add_post("/api/color", color)
        runner = web.AppRunner(app)
        await runner.setup()
        try:
            server = await asyncio.get_running_loop().create_server(runner.server, "127.0.0.1", 0)
            async with server:
                port = server.sockets[0].getsockname()[1]
                async with aiohttp.ClientSession() as session:
                    forwarder = Forwarder(session, replace(CONFIG, cloud_url=f"http://127.0.0.1:{port}"))
                    twitch = Twitch(session, twitch_config(), forwarder)
                    twitch.notification(notification())
                    twitch.notification(notification())
                    forwarder.submit("youtube", "ignored", "Alice", "please !red")
                    worker = asyncio.create_task(forwarder.run())
                    try:
                        await asyncio.wait_for(forwarder.queue.join(), 2)
                    finally:
                        worker.cancel()
                        await asyncio.gather(worker, return_exceptions=True)
                assert received == [("secret", {"username": "Bob", "color": {"r": 0, "g": 0, "b": 255}})]
        finally:
            await runner.cleanup()
    asyncio.run(scenario())


def test_youtube_error_backoff_respects_last_poll_interval(monkeypatch):
    async def scenario():
        youtube = YouTube(None, CONFIG, None)
        youtube.interval = 17
        youtube.poll = AsyncMock(side_effect=[APIError(429), APIError(403, "liveChatEnded")])
        sleep = AsyncMock()
        monkeypatch.setattr("stream_aggregator.youtube.asyncio.sleep", sleep)
        await youtube.run()
        sleep.assert_awaited_once_with(17)
    asyncio.run(scenario())


def test_twitch_connection_failure_reconnects(monkeypatch):
    async def scenario():
        twitch = Twitch(None, twitch_config(), None)
        twitch.validate = AsyncMock()
        twitch.listen = AsyncMock(side_effect=[asyncio.TimeoutError(), RuntimeError("revoked")])
        sleep = AsyncMock()
        monkeypatch.setattr("stream_aggregator.twitch.asyncio.sleep", sleep)
        with pytest.raises(RuntimeError, match="revoked"):
            await twitch.run()
        assert twitch.listen.await_count == 2
        sleep.assert_awaited_once_with(1)
    asyncio.run(scenario())


def test_forwarder_limits_concurrency_and_reuses_available_slot(monkeypatch):
    async def scenario():
        releases = [asyncio.Event() for _ in range(25)]
        ten_started, eleven_started = asyncio.Event(), asyncio.Event()
        started = active = peak = completed = 0

        async def post(*args, **kwargs):
            nonlocal started, active, peak, completed
            index = started
            started += 1
            active += 1
            peak = max(peak, active)
            if started == 10:
                ten_started.set()
            if started == 11:
                eleven_started.set()
            try:
                await releases[index].wait()
                completed += 1
                return {"status": "queued"}
            finally:
                active -= 1

        monkeypatch.setattr("stream_aggregator.forwarder.request", post)
        forwarder = Forwarder(None, CONFIG)
        for index in range(25):
            forwarder.submit("youtube", str(index), "Alice", "!red")
        worker = asyncio.create_task(forwarder.run())
        try:
            await asyncio.wait_for(ten_started.wait(), 1)
            assert started == active == 10
            assert forwarder.queue.qsize() == 15
            # Complete only one request; the other nine remain blocked.
            releases[0].set()
            await asyncio.wait_for(eleven_started.wait(), 1)
            assert completed == 1
            assert active == 10
            for release in releases:
                release.set()
            await asyncio.wait_for(forwarder.queue.join(), 1)
            assert completed == 25
            assert peak == 10
        finally:
            worker.cancel()
            await asyncio.gather(worker, return_exceptions=True)
        assert active == 0
    asyncio.run(scenario())


@pytest.mark.parametrize("fatal", [False, True])
def test_forwarder_cleans_up_all_in_flight_requests(monkeypatch, fatal):
    async def scenario():
        all_started = asyncio.Event()
        fail = asyncio.Event()
        active = 0

        async def post(*args, **kwargs):
            nonlocal active
            active += 1
            if active == 10:
                all_started.set()
            try:
                if kwargs["json"]["username"] == "first":
                    await fail.wait()
                    raise APIError(401)
                await asyncio.Event().wait()
            finally:
                active -= 1

        monkeypatch.setattr("stream_aggregator.forwarder.request", post)
        forwarder = Forwarder(None, CONFIG)
        for index in range(10):
            forwarder.submit("youtube", str(index), "first" if index == 0 else "other", "!red")
        worker = asyncio.create_task(forwarder.run())
        try:
            await asyncio.wait_for(all_started.wait(), 1)
            if fatal:
                fail.set()
                with pytest.raises(RuntimeError, match="credentials"):
                    await asyncio.wait_for(worker, 1)
            else:
                worker.cancel()
                await asyncio.gather(worker, return_exceptions=True)
            assert active == 0
            await asyncio.wait_for(forwarder.queue.join(), 1)
        finally:
            worker.cancel()
            await asyncio.gather(worker, return_exceptions=True)
    asyncio.run(scenario())
