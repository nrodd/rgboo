import asyncio
import logging
import math
from collections import OrderedDict

import aiohttp

from .colors import parse_color
from .http import APIError, request

log = logging.getLogger(__name__)
MAX_IN_FLIGHT = 10


class Forwarder:
    def __init__(self, session, config, capacity=1000):
        self.session = session
        self.config = config
        self.queue = asyncio.Queue(maxsize=capacity)
        self.seen = OrderedDict()

    def submit(self, source, message_id, username, text, *, reply=None, mention=None):
        color = parse_color(text)
        key = (source, message_id)
        if color is None or not message_id or not username or key in self.seen:
            return
        self.seen[key] = None
        if len(self.seen) > 10000:
            self.seen.popitem(last=False)
        try:
            self.queue.put_nowait(({"username": username, "color": color}, reply, mention or username, source))
        except asyncio.QueueFull:
            log.warning("Forward queue full; dropping color command from %s", source)

    async def run(self):
        workers = [asyncio.create_task(self._worker()) for _ in range(MAX_IN_FLIGHT)]
        try:
            await asyncio.gather(*workers)
        finally:
            # A fatal error or shutdown must also stop every in-flight request.
            for worker in workers:
                worker.cancel()
            await asyncio.gather(*workers, return_exceptions=True)

    async def _worker(self):
        while True:
            payload, reply, mention, source = await self.queue.get()
            try:
                result = await request(
                    self.session, "POST", self.config.cloud_url.rstrip("/") + "/api/color",
                    headers={"X-Api-Key": self.config.cloud_key}, json=payload,
                )
                log.info("Color command forwarded (source=%s)", source)
                if reply is not None:
                    await self.reply_with_estimate(result, reply, mention, source)
                else:
                    log.warning("No chat reply handler (source=%s)", source)
            except APIError as error:
                if error.status in (401, 403):
                    raise RuntimeError("Cloud API rejected credentials") from None
                log.warning("Cloud API rejected command (HTTP %s); not retried", error.status)
            except (aiohttp.ClientError, asyncio.TimeoutError):
                # The API has no idempotency key: retrying an ambiguous POST
                # could enqueue the same color twice.
                log.warning("Cloud delivery failed or is uncertain; not retried")
            finally:
                self.queue.task_done()

    async def reply_with_estimate(self, result, reply, mention, source="unknown"):
        seconds = result.get("estimated_wait_seconds") if isinstance(result, dict) else None
        if (not isinstance(result, dict) or result.get("status") != "queued"
                or isinstance(seconds, bool) or not isinstance(seconds, (int, float))
                or not math.isfinite(seconds) or seconds < 0):
            log.warning("Cloud response has no valid queue estimate; skipping chat reply (source=%s)", source)
            return
        seconds = math.ceil(seconds)
        estimate = "less than a second" if seconds == 0 else f"{seconds} second{'s' if seconds != 1 else ''}"
        text = f"@{mention.lstrip('@')} your color is queued! Estimated wait: {estimate}."
        try:
            log.info("Sending chat estimate reply (source=%s, estimated_wait_seconds=%s)", source, seconds)
            await reply(text)
            log.info("Chat estimate reply sent (source=%s)", source)
        except APIError as error:
            log.warning("Chat estimate reply rejected (source=%s, HTTP %s, reason=%s); not retried",
                        source, error.status, error.log_reason)
        except (aiohttp.ClientError, asyncio.TimeoutError, ValueError) as error:
            # A failed acknowledgement must never resubmit an accepted color or
            # be mistaken for a cloud authentication failure.
            log.warning("Chat estimate reply failed or is uncertain (source=%s, error=%s); not retried",
                        source, type(error).__name__)
