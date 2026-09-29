import asyncio
from datetime import datetime, timedelta, timezone
from dataclasses import replace
from unittest.mock import AsyncMock, Mock

import grpc
import pytest

from stream_aggregator.config import Config
from stream_aggregator.forwarder import Forwarder
from stream_aggregator.http import APIError
from stream_aggregator.youtube import YouTube
from stream_aggregator.youtube_budget import YouTubeBudget, BudgetExhausted, PACIFIC
from stream_aggregator import stream_list_pb2 as proto

CONFIG = Config("https://cloud.example", "key", youtube_key="yt-key", youtube_chat="chat",
                youtube_token="oauth")


def batch(identifier, published, cursor="cursor", kind=1):
    return proto.LiveChatMessageListResponse(next_page_token=cursor, items=[proto.LiveChatMessage(
        id=identifier, author_details=proto.LiveChatMessageAuthorDetails(display_name="Alice"),
        snippet=proto.LiveChatMessageSnippet(type=kind, published_at=published,
            text_message_details=proto.LiveChatTextMessageDetails(message_text="!red")))])


def test_history_spans_batches_and_cursor_survives_duplicates():
    youtube = YouTube(None, CONFIG, Forwarder(None, CONFIG))
    old = (youtube.history_cutoff - timedelta(minutes=1)).isoformat()
    new = (youtube.history_cutoff + timedelta(seconds=1)).isoformat()
    youtube.consume(batch("old-1", old, "p1"))
    youtube.consume(batch("old-2", old, "p2"))
    youtube.consume(batch("missing-time", "", "p3"))
    youtube.consume(batch("new", new, "p4"))
    youtube.consume(batch("new", new, "p5"))
    assert youtube.page_token == "p5"
    assert youtube.forwarder.queue.qsize() == 1
    assert youtube.consume(proto.LiveChatMessageListResponse(offline_at=new))
    assert youtube.consume(batch("end", new, kind=4))


def test_stream_contract_resume_and_cancellation(monkeypatch):
    async def scenario():
        entered = asyncio.Event()
        closed = []
        requests = []
        youtube = YouTube(None, CONFIG, Mock())
        youtube.page_token = "resume-token"
        response = batch("live", datetime.now(timezone.utc).isoformat(), "next-token")
        class Channel:
            async def __aenter__(self):
                return self
            async def __aexit__(self, *args):
                closed.append(True)
            def unary_stream(self, method, **kwargs):
                assert method == "/youtube.api.v3.V3DataLiveChatMessageService/StreamList"
                assert kwargs["response_deserializer"](response.SerializeToString()) == response
                async def call(request, *, metadata):
                    requests.append((request, metadata))
                    yield response
                    entered.set()
                    await asyncio.Event().wait()
                return call
        channel = Mock(return_value=Channel())
        monkeypatch.setattr("stream_aggregator.youtube.grpc.aio.secure_channel", channel)
        task = asyncio.create_task(youtube.stream())
        await asyncio.wait_for(entered.wait(), 1)
        assert not task.done()  # Quiet connection stays open, no polling loop.
        assert youtube.page_token == "next-token"
        request, metadata = requests[0]
        assert request.live_chat_id == "chat"
        assert request.page_token == "resume-token"
        assert list(request.part) == ["id", "snippet", "authorDetails"]
        assert metadata == (("x-goog-api-key", "yt-key"),)
        task.cancel()
        await asyncio.gather(task, return_exceptions=True)
        assert closed == [True]
        youtube.forwarder.submit.assert_called_once()
    asyncio.run(scenario())


def rpc_error(code):
    return grpc.aio.AioRpcError(code, grpc.aio.Metadata(), grpc.aio.Metadata())


def test_reconnects_back_off_and_keep_cursor(monkeypatch):
    async def scenario():
        youtube = YouTube(None, CONFIG, Mock())
        youtube.page_token = "resume"
        youtube.stream = AsyncMock(side_effect=[rpc_error(grpc.StatusCode.UNAVAILABLE), False, True])
        sleep = AsyncMock()
        monkeypatch.setattr("stream_aggregator.youtube.asyncio.sleep", sleep)
        await youtube.run()
        assert [c.args[0] for c in sleep.call_args_list] == [5, 10]
        assert youtube.page_token == "resume"
    asyncio.run(scenario())


def test_invalid_cursor_resets_only_once(monkeypatch):
    async def scenario():
        youtube = YouTube(None, CONFIG, Mock())
        youtube.page_token = "bad"
        youtube.stream = AsyncMock(side_effect=[rpc_error(grpc.StatusCode.INVALID_ARGUMENT),
                                               rpc_error(grpc.StatusCode.INVALID_ARGUMENT)])
        sleep = AsyncMock()
        monkeypatch.setattr("stream_aggregator.youtube.asyncio.sleep", sleep)
        await youtube.run()
        assert youtube.page_token is None
        assert youtube.stream.await_count == 2
        sleep.assert_awaited_once_with(5)
    asyncio.run(scenario())


@pytest.mark.parametrize("grpc_quota", [True, False])
def test_quota_exhaustion_waits_and_persists_without_crashing(monkeypatch, tmp_path, grpc_quota):
    async def scenario():
        config = replace(CONFIG, youtube_budget_file=str(tmp_path / "budget.sqlite3"))
        youtube = YouTube(None, config, Mock())
        if grpc_quota:
            youtube.stream = AsyncMock(side_effect=rpc_error(grpc.StatusCode.RESOURCE_EXHAUSTED))
        else:
            youtube.discover = AsyncMock(side_effect=APIError(403, "quotaExceeded"))
        sleep = AsyncMock(side_effect=asyncio.CancelledError)
        monkeypatch.setattr("stream_aggregator.youtube.asyncio.sleep", sleep)
        with pytest.raises(asyncio.CancelledError):
            await youtube.run()
        assert 0 < sleep.call_args.args[0] <= 25 * 3600 + 60
        reopened = YouTubeBudget(config.youtube_budget_file)
        for kind in ("reply", "read"):
            with pytest.raises(BudgetExhausted):
                reopened.reserve(kind)
    asyncio.run(scenario())


def test_budget_persists_and_reserves_reads(tmp_path):
    path = str(tmp_path / "budget.sqlite3")
    budget = YouTubeBudget(path, reply_limit=2, read_limit=2)
    budget.reserve("reply")
    restarted = YouTubeBudget(path, reply_limit=2, read_limit=2)
    restarted.reserve("reply")
    with pytest.raises(BudgetExhausted):
        budget.reserve("reply")
    budget.reserve("read")
    budget.reserve("read")
    with pytest.raises(BudgetExhausted):
        restarted.reserve("read")
    tomorrow = budget.now() + timedelta(days=1)
    restarted.now = lambda: tomorrow
    restarted.reserve("reply")


def test_budget_pacific_reset_and_dst():
    budget = YouTubeBudget(":memory:")
    budget.now = lambda: datetime(2026, 11, 1, 0, 0, tzinfo=PACIFIC)
    assert budget.reset_delay() == 25 * 3600 + 60
    budget.now = lambda: datetime(2026, 9, 27, 23, 59, tzinfo=PACIFIC)
    assert budget.reset_delay() == 120


def test_reply_cap_preserves_color_forwarding(monkeypatch):
    async def scenario():
        config = replace(CONFIG, youtube_daily_replies=1)
        youtube = YouTube(None, config, Mock())
        post = AsyncMock(return_value={})
        monkeypatch.setattr("stream_aggregator.youtube.request", post)
        await youtube.send_reply("chat", "first")
        with pytest.raises(BudgetExhausted):
            await youtube.send_reply("chat", "second")
        assert post.await_count == 1
        cloud = AsyncMock(return_value={"status": "queued", "estimated_wait_seconds": 10})
        monkeypatch.setattr("stream_aggregator.forwarder.request", cloud)
        forwarder = Forwarder(None, CONFIG)
        forwarder.submit("youtube", "id", "Alice", "!red", reply=lambda text: youtube.send_reply("chat", text))
        worker = asyncio.create_task(forwarder.run())
        try:
            await asyncio.wait_for(forwarder.queue.join(), 1)
            assert not worker.done()
            cloud.assert_awaited_once()
            assert post.await_count == 1
        finally:
            worker.cancel()
            await asyncio.gather(worker, return_exceptions=True)
    asyncio.run(scenario())


def test_failed_reply_consumes_budget_and_quota_failure_blocks_reads(monkeypatch):
    async def scenario():
        youtube = YouTube(None, replace(CONFIG, youtube_daily_replies=1), Mock())
        post = AsyncMock(side_effect=APIError(403, "quotaExceeded"))
        monkeypatch.setattr("stream_aggregator.youtube.request", post)
        with pytest.raises(APIError):
            await youtube.send_reply("chat", "first")
        with pytest.raises(BudgetExhausted):
            await youtube.send_reply("chat", "second")
        with pytest.raises(BudgetExhausted):
            await youtube.get("videos")
        assert post.await_count == 1
    asyncio.run(scenario())


def test_real_grpc_stream_delivery_and_resume(monkeypatch):
    async def scenario():
        forwarder = Forwarder(None, CONFIG)
        youtube = YouTube(None, CONFIG, forwarder)
        youtube.page_token = "resume"
        observed = []
        async def handler(request, context):
            observed.append((request, dict(context.invocation_metadata())))
            yield batch("old", (youtube.history_cutoff - timedelta(days=1)).isoformat(), "p1")
            yield batch("new", datetime.now(timezone.utc).isoformat(), "p2")
            yield proto.LiveChatMessageListResponse(offline_at="ended")
        server = grpc.aio.server()
        server.add_generic_rpc_handlers((grpc.method_handlers_generic_handler(
            "youtube.api.v3.V3DataLiveChatMessageService", {
                "StreamList": grpc.unary_stream_rpc_method_handler(handler,
                    request_deserializer=proto.LiveChatMessageListRequest.FromString,
                    response_serializer=proto.LiveChatMessageListResponse.SerializeToString)
            }),))
        port = server.add_insecure_port("127.0.0.1:0")
        await server.start()
        monkeypatch.setattr("stream_aggregator.youtube.grpc.aio.secure_channel",
                            lambda *args, **kwargs: grpc.aio.insecure_channel(f"127.0.0.1:{port}"))
        try:
            assert await asyncio.wait_for(youtube.stream(), 3)
            assert forwarder.queue.qsize() == 1
            assert youtube.page_token == "p2"
            assert observed[0][0].page_token == "resume"
            assert observed[0][1]["x-goog-api-key"] == "yt-key"
        finally:
            await server.stop(None)
    asyncio.run(scenario())


@pytest.mark.parametrize("field,value", [("YOUTUBE_DAILY_REPLIES", "161"),
    ("YOUTUBE_DAILY_READS", "1001"), ("YOUTUBE_DAILY_REPLIES", "-1"),
    ("YOUTUBE_DAILY_READS", "oops")])
def test_budget_configuration_rejects_unsafe_limits(monkeypatch, field, value):
    monkeypatch.setenv(field, value)
    with pytest.raises(ValueError, match=field):
        Config.from_env()
