import asyncio
import logging
import time
from functools import partial
from datetime import datetime, timezone

import grpc

from . import stream_list_pb2 as proto
from .youtube_budget import BudgetExhausted, YouTubeBudget

import aiohttp

from .http import APIError, request

log = logging.getLogger(__name__)
BASE = "https://www.googleapis.com/youtube/v3/"


class YouTube:
    def __init__(self, session, config, forwarder):
        self.session, self.config, self.forwarder = session, config, forwarder
        self.chat_id = config.youtube_chat
        self.page_token = None
        self.history_cutoff = datetime.now(timezone.utc)
        self.budget = YouTubeBudget(config.youtube_budget_file, config.youtube_daily_replies, config.youtube_daily_reads)
        self.token = config.youtube_token
        self.token_expires = 0
        self.reply_lock = asyncio.Lock()

    async def send_reply(self, chat_id, text):
        async with self.reply_lock:
            self.budget.reserve("reply")
            if self.config.youtube_refresh and time.monotonic() >= self.token_expires:
                log.info("Refreshing YouTube reply access token")
                result = await request(self.session, "POST", "https://oauth2.googleapis.com/token", data={
                    "grant_type": "refresh_token", "refresh_token": self.config.youtube_refresh,
                    "client_id": self.config.youtube_client, "client_secret": self.config.youtube_secret,
                })
                self.token = result["access_token"]
                self.token_expires = time.monotonic() + max(0, result.get("expires_in", 3600) - 60)
                log.info("YouTube reply access token refreshed")
            try:
                await request(
                    self.session, "POST", BASE + "liveChat/messages",
                    headers={"Authorization": f"Bearer {self.token}"}, params={"part": "snippet"},
                    json={"snippet": {"liveChatId": chat_id, "type": "textMessageEvent",
                                      "textMessageDetails": {"messageText": text}}},
                )
            except APIError as error:
                if error.reason in ("quotaExceeded", "dailyLimitExceeded"):
                    self.budget.block_today()
                raise

    async def get(self, resource, **params):
        self.budget.reserve("read")
        return await request(self.session, "GET", BASE + resource,
                             params={"key": self.config.youtube_key, **params})

    async def discover(self):
        if self.chat_id:
            return True
        result = await self.get("videos", part="liveStreamingDetails", id=self.config.youtube_video)
        items = result.get("items", [])
        self.chat_id = (items[0].get("liveStreamingDetails", {}).get("activeLiveChatId", "")
                        if items else "")
        if not self.chat_id:
            log.info("YouTube video has no active chat; checking again in 5 minutes")
        return bool(self.chat_id)

    def consume(self, response):
        ended = bool(response.offline_at)
        for item in response.items:
            snippet = item.snippet
            if snippet.type == 4:
                ended = True
            if snippet.type != 1:
                continue
            try:
                published = datetime.fromisoformat(snippet.published_at.replace("Z", "+00:00"))
                if published < self.history_cutoff:
                    continue
            except (ValueError, TypeError):
                # Initial history can span several responses. Require a timestamp
                # for every message, instead of merely skipping the first batch.
                continue
            self.forwarder.submit(
                "youtube", item.id, item.author_details.display_name,
                snippet.text_message_details.message_text,
                reply=partial(self.send_reply, self.chat_id),
            )
        if response.next_page_token:
            self.page_token = response.next_page_token
        return ended

    async def stream(self):
        self.budget.reserve("read")
        async with grpc.aio.secure_channel(
            "youtube.googleapis.com:443", grpc.ssl_channel_credentials(),
        ) as channel:
            call = channel.unary_stream(
                "/youtube.api.v3.V3DataLiveChatMessageService/StreamList",
                request_serializer=proto.LiveChatMessageListRequest.SerializeToString,
                response_deserializer=proto.LiveChatMessageListResponse.FromString,
            )
            request_message = proto.LiveChatMessageListRequest(
                live_chat_id=self.chat_id, part=["id", "snippet", "authorDetails"],
            )
            if self.page_token:
                request_message.page_token = self.page_token
            # No 20-second HTTP timeout or quiet-chat read timeout: this RPC is
            # intentionally long-lived. Cancellation closes the channel.
            async for response in call(request_message, metadata=(("x-goog-api-key", self.config.youtube_key),)):
                log.debug("YouTube streamList batch received")
                if self.consume(response):
                    return True
        return False

    async def run(self):
        backoff = 5
        while True:
            try:
                if not await self.discover():
                    await asyncio.sleep(300)
                    continue
                log.info("YouTube streamList connecting (resume=%s)", bool(self.page_token))
                if await self.stream():
                    log.info("YouTube chat ended")
                    return
                # Even clean EOFs back off, preventing reconnect loops.
                delay = backoff
            except BudgetExhausted:
                delay = self.budget.reset_delay()
                log.warning("YouTube daily budget reached; pausing until Pacific quota reset")
            except grpc.aio.AioRpcError as error:
                code = error.code()
                if code == grpc.StatusCode.FAILED_PRECONDITION:
                    log.info("YouTube chat ended or is disabled")
                    return
                if code == grpc.StatusCode.RESOURCE_EXHAUSTED:
                    self.budget.block_today()
                    delay = self.budget.reset_delay()
                    log.warning("YouTube quota/rate limit reached; pausing until Pacific quota reset")
                elif code == grpc.StatusCode.INVALID_ARGUMENT and self.page_token:
                    self.page_token = None
                    self.history_cutoff = datetime.now(timezone.utc)
                    delay = backoff
                    log.warning("YouTube rejected stream cursor; reconnecting without history")
                elif code in (grpc.StatusCode.UNAVAILABLE, grpc.StatusCode.INTERNAL,
                              grpc.StatusCode.DEADLINE_EXCEEDED, grpc.StatusCode.CANCELLED):
                    delay = backoff
                    log.warning("YouTube stream interrupted (%s); backing off", code.name)
                else:
                    # Isolate a platform failure so Twitch can keep running.
                    log.error("YouTube streaming stopped (%s); check API access/configuration", code.name)
                    return
            except APIError as error:
                if error.reason in ("quotaExceeded", "dailyLimitExceeded"):
                    self.budget.block_today()
                    delay = self.budget.reset_delay()
                    log.warning("YouTube quota exhausted; pausing until Pacific quota reset")
                elif error.status in (429, 500, 502, 503, 504) or error.reason == "rateLimitExceeded":
                    delay = backoff
                else:
                    log.error("YouTube discovery stopped (HTTP %s, reason=%s)", error.status, error.log_reason)
                    return
            except (aiohttp.ClientError, asyncio.TimeoutError):
                delay = backoff
                log.warning("YouTube network failure; backing off")
            await asyncio.sleep(delay)
            backoff = min(backoff * 2, 300)
