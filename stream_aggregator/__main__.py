import asyncio
import logging
import signal

import aiohttp

from .config import Config
from .forwarder import Forwarder
from .twitch import Twitch
from .youtube import YouTube

log = logging.getLogger(__name__)


async def run(config):
    stop = asyncio.Event()
    loop = asyncio.get_running_loop()
    for sig in (signal.SIGINT, signal.SIGTERM):
        loop.add_signal_handler(sig, stop.set)
    async with aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=20)) as session:
        forwarder = Forwarder(session, config)
        twitch = Twitch(session, config, forwarder) if config.twitch_channel else None
        worker = asyncio.create_task(forwarder.run())
        producers = []
        background = []
        if config.youtube_video or config.youtube_chat:
            producers.append(asyncio.create_task(YouTube(session, config, forwarder).run()))
        if twitch is not None:
            producers.append(asyncio.create_task(twitch.run()))
            background.append(asyncio.create_task(twitch.maintain_token()))
        stopper = asyncio.create_task(stop.wait())
        tasks = [worker, stopper, *producers, *background]
        try:
            active = set(tasks)
            while producers:
                done, _ = await asyncio.wait(active, return_when=asyncio.FIRST_COMPLETED)
                for task in done:
                    task.result()  # Fail visibly if credentials or a worker fail.
                if stopper in done:
                    break
                for task in done:
                    active.remove(task)
                    if task in producers:
                        producers.remove(task)
            for task in producers + background:
                task.cancel()
            await asyncio.gather(*producers, *background, return_exceptions=True)
            try:
                await asyncio.wait_for(forwarder.queue.join(), timeout=25)
            except asyncio.TimeoutError:
                log.warning("Shutdown deadline reached; queued commands will be lost")
        finally:
            for task in tasks:
                task.cancel()
            await asyncio.gather(*tasks, return_exceptions=True)


def main():
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
    try:
        asyncio.run(run(Config.from_env()))
    except (ValueError, RuntimeError) as error:
        log.error("%s", error)
        raise SystemExit(1) from None
    except Exception as error:
        # Network exceptions may embed credential-bearing request URLs.
        log.error("Service failed (%s); check configuration and connectivity", type(error).__name__)
        raise SystemExit(1) from None


if __name__ == "__main__":
    main()
