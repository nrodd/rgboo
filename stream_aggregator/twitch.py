import asyncio
import json
import logging
import os
from pathlib import Path

import aiohttp

from .http import APIError, request

log = logging.getLogger(__name__)
WS_URL = "wss://eventsub.wss.twitch.tv/ws"


class Twitch:
    def __init__(self, session, config, forwarder):
        self.session, self.config, self.forwarder = session, config, forwarder
        self.token, self.refresh_token = config.twitch_token, config.twitch_refresh
        self.lock = asyncio.Lock()
        if config.twitch_token_file and Path(config.twitch_token_file).exists():
            saved = json.loads(Path(config.twitch_token_file).read_text())
            self.token, self.refresh_token = saved["access_token"], saved["refresh_token"]

    async def refresh(self):
        if not self.refresh_token or not self.config.twitch_secret or not self.config.twitch_token_file:
            raise RuntimeError("Twitch token expired; supply a new token or configure refresh credentials")
        result = await request(self.session, "POST", "https://id.twitch.tv/oauth2/token", data={
            "grant_type": "refresh_token", "refresh_token": self.refresh_token,
            "client_id": self.config.twitch_client, "client_secret": self.config.twitch_secret,
        })
        self.token = result["access_token"]
        self.refresh_token = result["refresh_token"]
        path = Path(self.config.twitch_token_file)
        path.parent.mkdir(parents=True, exist_ok=True)
        temp = path.with_suffix(".tmp")
        with os.fdopen(os.open(temp, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600), "w") as out:
            json.dump({"access_token": self.token, "refresh_token": self.refresh_token}, out)
        temp.replace(path)

    async def validate(self):
        async with self.lock:
            try:
                result = await request(self.session, "GET", "https://id.twitch.tv/oauth2/validate",
                                       headers={"Authorization": f"OAuth {self.token}"})
            except APIError as error:
                if error.status != 401:
                    raise
                await self.refresh()
                result = await request(self.session, "GET", "https://id.twitch.tv/oauth2/validate",
                                       headers={"Authorization": f"OAuth {self.token}"})
            if (result.get("client_id") != self.config.twitch_client
                    or result.get("user_id") != self.config.twitch_user
                    or "user:read:chat" not in result.get("scopes", [])):
                raise RuntimeError("Twitch token must match client/bot IDs and include user:read:chat")
            expires = result.get("expires_in", 3600)
            if expires < 300 and self.refresh_token:
                await self.refresh()
                return 60
            return min(3600, max(30, expires - 120))

    async def maintain_token(self):
        while True:
            try:
                delay = await self.validate()
            except (aiohttp.ClientError, asyncio.TimeoutError):
                delay = 30
                log.warning("Twitch token validation network failure; retrying")
            except APIError as error:
                if error.status < 500 and error.status != 429:
                    raise RuntimeError("Twitch token validation/refresh rejected") from None
                delay = 30
            await asyncio.sleep(delay)

    async def subscribe(self, session_id):
        async with self.lock:
            await request(self.session, "POST", "https://api.twitch.tv/helix/eventsub/subscriptions",
                          headers={"Authorization": f"Bearer {self.token}", "Client-Id": self.config.twitch_client},
                          json={"type": "channel.chat.message", "version": "1", "condition": {
                              "broadcaster_user_id": self.config.twitch_channel,
                              "user_id": self.config.twitch_user,
                          }, "transport": {"method": "websocket", "session_id": session_id}})

    def notification(self, message):
        payload = message["payload"]
        subscription = payload.get("subscription", {})
        if subscription.get("type") != "channel.chat.message":
            return
        event = payload["event"]
        if event.get("broadcaster_user_id") != self.config.twitch_channel:
            return
        self.forwarder.submit("twitch", event.get("message_id"), event.get("chatter_user_name"),
                              event.get("message", {}).get("text", ""))

    async def open_socket(self, url):
        # aiohttp handles protocol pings automatically; don't send client pings.
        socket = await self.session.ws_connect(url, autoping=True)
        try:
            welcome = await socket.receive_json(timeout=10)
            if welcome.get("metadata", {}).get("message_type") != "session_welcome":
                raise RuntimeError("Twitch did not send a welcome")
            return socket, welcome["payload"]["session"]
        except BaseException:
            await socket.close()
            raise

    async def listen(self):
        socket = None
        migration = None
        try:
            socket, session = await self.open_socket(WS_URL)
            await self.subscribe(session["id"])
            timeout = session.get("keepalive_timeout_seconds") or 10
            log.info("Twitch chat subscribed")
            while True:
                message = await socket.receive_json(timeout=timeout + 2)
                kind = message["metadata"]["message_type"]
                if kind == "notification":
                    self.notification(message)
                elif kind == "revocation":
                    raise RuntimeError("Twitch chat subscription revoked; check authorization")
                elif kind == "session_reconnect" and migration is None:
                    migration = asyncio.create_task(self.open_socket(message["payload"]["session"]["reconnect_url"]))
                if migration is not None:
                    # Keep draining the original connection until the replacement
                    # welcome arrives. Subscriptions migrate; do not recreate them.
                    while True:
                        receive = asyncio.create_task(socket.receive_json(timeout=timeout + 2))
                        try:
                            done, _ = await asyncio.wait({receive, migration}, return_when=asyncio.FIRST_COMPLETED)
                            if receive in done:
                                old_message = receive.result()
                                old_kind = old_message["metadata"]["message_type"]
                                if old_kind == "notification":
                                    self.notification(old_message)
                                elif old_kind == "revocation":
                                    raise RuntimeError("Twitch chat subscription revoked")
                            if migration in done:
                                new_socket, session = migration.result()
                                migration = None
                                old_socket, socket = socket, new_socket
                                await old_socket.close()
                                timeout = session.get("keepalive_timeout_seconds") or timeout
                                break
                        finally:
                            receive.cancel()
                            await asyncio.gather(receive, return_exceptions=True)
        finally:
            if migration is not None:
                migration.cancel()
                result = await asyncio.gather(migration, return_exceptions=True)
                if isinstance(result[0], tuple):
                    await result[0][0].close()
            if socket is not None:
                await socket.close()

    async def run(self):
        backoff = 1
        while True:
            try:
                await self.validate()
                await self.listen()
            except APIError as error:
                if error.status < 500 and error.status not in (401, 429):
                    raise RuntimeError(f"Twitch API rejected configuration (HTTP {error.status})") from None
                log.warning("Twitch API unavailable; reconnecting")
            except (aiohttp.ClientError, asyncio.TimeoutError, ConnectionError, TypeError):
                log.warning("Twitch connection lost; reconnecting")
            await asyncio.sleep(backoff)
            backoff = min(backoff * 2, 60)
