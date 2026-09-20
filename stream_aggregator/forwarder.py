import asyncio
import logging
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

    def submit(self, source, message_id, username, text):
        color = parse_color(text)
        key = (source, message_id)
        if color is None or not message_id or not username or key in self.seen:
            return
        self.seen[key] = None
        if len(self.seen) > 10000:
            self.seen.popitem(last=False)
        try:
            self.queue.put_nowait({"username": username, "color": color})
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
            payload = await self.queue.get()
            try:
                await request(
                    self.session, "POST", self.config.cloud_url.rstrip("/") + "/api/color",
                    headers={"X-Api-Key": self.config.cloud_key}, json=payload,
                )
                log.info("Color command forwarded")
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
