import { beforeEach } from "vitest";
import type { TwitchAPI } from "../../media/twitchPlayer";

// Normal tests never load the live channel or the external embed script.
beforeEach(() => {
  const Player = class {
    constructor(element: HTMLElement) {
      let muted = true, volume = 0.7, paused = true;
      const listeners = new Map<string, (() => void)[]>();
      const fire = (event: string) => listeners.get(event)?.forEach((callback) => callback());
      element.appendChild(document.createElement("iframe"));
      const player = {
        play: () => { paused = false; fire("playing"); }, pause: () => { paused = true; fire("pause"); },
        isPaused: () => paused, getEnded: () => false,
        setMuted: (value: boolean) => { muted = value; }, getMuted: () => muted,
        setVolume: (value: number) => { volume = value; }, getVolume: () => volume,
        addEventListener: (event: string, callback: () => void) => listeners.set(event, [...(listeners.get(event) ?? []), callback]),
      };
      queueMicrotask(() => { if (element.isConnected || element.parentNode) fire("ready"); });
      return player;
    }
  };
  window.Twitch = { Player: Object.assign(Player, { READY: "ready", PLAY: "play", PLAYING: "playing", PAUSE: "pause", ENDED: "ended", OFFLINE: "offline", ONLINE: "online", PLAYBACK_BLOCKED: "playbackblocked" }) as unknown as TwitchAPI["Player"] };
});
