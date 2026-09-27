import asyncio
import logging
import time
from functools import partial

import aiohttp

from .http import APIError, request

log = logging.getLogger(__name__)
BASE = "https://www.googleapis.com/youtube/v3/"


class YouTube:
    def __init__(self, session, config, forwarder):
        self.session, self.config, self.forwarder = session, config, forwarder
        self.chat_id = config.youtube_chat
        self.page_token = None
        self.started = False
        self.interval = 5.0
        self.token = config.youtube_token
        self.token_expires = 0
        self.reply_lock = asyncio.Lock()

    async def send_reply(self, chat_id, text):
        async with self.reply_lock:
            if self.config.youtube_refresh and time.monotonic() >= self.token_expires:
                log.info("Refreshing YouTube reply access token")
                result = await request(self.session, "POST", "https://oauth2.googleapis.com/token", data={
                    "grant_type": "refresh_token", "refresh_token": self.config.youtube_refresh,
                    "client_id": self.config.youtube_client, "client_secret": self.config.youtube_secret,
                })
                self.token = result["access_token"]
                self.token_expires = time.monotonic() + max(0, result.get("expires_in", 3600) - 60)
                log.info("YouTube reply access token refreshed")
            await request(
                self.session, "POST", BASE + "liveChat/messages",
                headers={"Authorization": f"Bearer {self.token}"}, params={"part": "snippet"},
                json={"snippet": {"liveChatId": chat_id, "type": "textMessageEvent",
                                  "textMessageDetails": {"messageText": text}}},
            )

    async def get(self, resource, **params):
        return await request(self.session, "GET", BASE + resource,
                             params={"key": self.config.youtube_key, **params})

    async def poll(self):
        if not self.chat_id:
            result = await self.get("videos", part="liveStreamingDetails", id=self.config.youtube_video)
            items = result.get("items", [])
            self.chat_id = (items[0].get("liveStreamingDetails", {}).get("activeLiveChatId", "")
                            if items else "")
            if not self.chat_id:
                log.info("YouTube video has no active chat; checking again in 60 seconds")
                return 60
        params = {"liveChatId": self.chat_id, "part": "snippet,authorDetails", "maxResults": 2000}
        if self.page_token:
            params["pageToken"] = self.page_token
        result = await self.get("liveChat/messages", **params)
        if not self.started:
            log.info("YouTube chat polling connected; skipping initial history")
        # First response contains history. Start at its cursor to avoid replaying
        # old colors when the container starts or a page token is invalidated.
        if self.started:
            for item in result.get("items", []):
                snippet = item.get("snippet", {})
                if snippet.get("type") == "textMessageEvent":
                    self.forwarder.submit(
                        "youtube", item.get("id"), item.get("authorDetails", {}).get("displayName"),
                        snippet.get("textMessageDetails", {}).get("messageText", ""),
                        reply=partial(self.send_reply, self.chat_id),
                    )
        self.page_token = result.get("nextPageToken")
        self.started = bool(self.page_token)
        self.interval = max(1.0, result.get("pollingIntervalMillis", 5000) / 1000)
        if result.get("offlineAt"):
            log.info("YouTube stream ended")
            return None
        return self.interval

    async def run(self):
        backoff = 5
        while True:
            try:
                delay = await self.poll()
                if delay is None:
                    return
                backoff = 5
            except APIError as error:
                if error.reason in ("liveChatEnded", "liveChatDisabled"):
                    log.info("YouTube chat ended or is disabled")
                    return
                if error.reason == "invalidPageToken":
                    self.page_token, self.started = None, False
                elif error.status not in (429, 500, 502, 503, 504) and error.reason != "rateLimitExceeded":
                    raise RuntimeError(f"YouTube configuration/access error (HTTP {error.status})") from None
                delay = max(self.interval, backoff)
                backoff = min(backoff * 2, 300)
                log.warning("YouTube polling failed (HTTP %s); backing off", error.status)
            except (aiohttp.ClientError, asyncio.TimeoutError):
                delay = max(self.interval, backoff)
                backoff = min(backoff * 2, 300)
                log.warning("YouTube network failure; backing off")
            await asyncio.sleep(delay)
