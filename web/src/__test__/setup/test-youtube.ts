import { beforeEach } from "vitest";
import type { YouTubeAPI } from "../../media/youtubePlayer";

// Normal tests never load the live broadcast or the external API script.
// Live checks have a separate config and retain the production adapter.

beforeEach(() => {
  window.YT = { Player: class {
    constructor(_iframe: HTMLIFrameElement, { events }: ConstructorParameters<YouTubeAPI["Player"]>[1]) {
      let muted = true, volume = 70, state = 2, disposed = false;
      const player = {
        playVideo: () => { state = 1; events.onStateChange({ target: player, data: state }); },
        pauseVideo: () => { state = 2; events.onStateChange({ target: player, data: state }); },
        mute: () => { muted = true; }, unMute: () => { muted = false; },
        setVolume: (value: number) => { volume = value; }, getVolume: () => volume,
        isMuted: () => muted, getPlayerState: () => state,
        destroy: () => { disposed = true; },
      };
      queueMicrotask(() => { if (!disposed) events.onReady({ target: player, data: 0 }); });
      return player;
    }
  } as YouTubeAPI["Player"] };
});
