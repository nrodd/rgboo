import type { PlaybackStatus } from "./playbackStatus";
interface TwitchPlayer {
  play(): void; pause(): void; isPaused(): boolean; getEnded(): boolean;
  setMuted(muted: boolean): void; getMuted(): boolean;
  setVolume(volume: number): void; getVolume(): number;
  addEventListener(event: string, callback: () => void): void;
}
export interface TwitchAPI {
  Player: {
    new (element: HTMLElement, options: { channel: string; parent: string[]; width: string; height: string; autoplay: boolean; muted: boolean; controls?: boolean }): TwitchPlayer;
    READY: string; PLAY: string; PLAYING: string; PAUSE: string; ENDED: string; OFFLINE: string; ONLINE: string; PLAYBACK_BLOCKED: string;
  };
}
declare global { interface Window { Twitch?: TwitchAPI } }
let apiPromise: Promise<TwitchAPI> | undefined;
export function loadTwitchAPI(): Promise<TwitchAPI> {
  if (window.Twitch?.Player) return Promise.resolve(window.Twitch);
  if (apiPromise) return apiPromise;
  apiPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    const fail = () => { clearTimeout(timeout); script.remove(); apiPromise = undefined; reject(new Error("Twitch API unavailable")); };
    const timeout = window.setTimeout(fail, 15000);
    script.onload = () => { clearTimeout(timeout); if (window.Twitch?.Player) resolve(window.Twitch); else fail(); };
    script.src = "https://player.twitch.tv/js/embed/v1.js";
    script.async = true;
    script.onerror = fail;
    document.head.appendChild(script);
  });
  return apiPromise;
}
export interface TwitchState { status: PlaybackStatus; ready: boolean; muted: boolean; volume: number }
export interface TwitchHandle { togglePlayback(): void; toggleSound(): void; setVolume(volume: number): void; retry(): void; destroy(): void }

export const twitchWatchUrl = (channel: string) => `https://www.twitch.tv/${encodeURIComponent(channel)}`;

export function createTwitchPlayer(host: HTMLElement, channel: string, onChange: (state: TwitchState) => void): TwitchHandle {
  let disposed = false, generation = 0;
  let player: TwitchPlayer | undefined;
  let mount: HTMLDivElement | undefined;
  let poll: number | undefined, readinessTimeout: number | undefined;
  const state: TwitchState = { status: channel ? "loading" : "unconfigured", ready: false, muted: false, volume: 70 };
  const emit = () => { if (!disposed) onChange({ ...state }); };
  const sync = () => {
    if (!state.ready || disposed || !player) return;
    state.muted = player.getMuted(); state.volume = Math.round(player.getVolume() * 100); emit();
  };
  // Twitch has no destroy(); dropping the mount removes its iframe and listeners with it.
  const release = () => { clearInterval(poll); clearTimeout(readinessTimeout); player = undefined; mount?.remove(); mount = undefined; };
  const nativeFrame = (target: HTMLElement) => {
    const frame = document.createElement("iframe");
    frame.title = "RGBOO live stream on Twitch";
    frame.allow = "autoplay; fullscreen";
    frame.allowFullscreen = true;
    frame.src = `https://player.twitch.tv/?${new URLSearchParams({ channel, parent: window.location.hostname, autoplay: "true", muted: String(state.muted) })}`;
    target.appendChild(frame);
  };
  const connect = async () => {
    if (disposed) return;
    const current = ++generation;
    release();
    state.ready = false;
    state.status = channel ? "loading" : "unconfigured";
    emit();
    if (!channel) return;
    // Same Strict Mode guard as the YouTube adapter: never start an embed for an abandoned effect.
    let api: TwitchAPI | undefined;
    try { api = await loadTwitchAPI(); } catch { /* Native controls remain available. */ }
    if (disposed || current !== generation) return;
    const target = document.createElement("div");
    target.className = "stream-mount";
    mount = target; host.appendChild(target);
    if (!api) { nativeFrame(target); state.status = "blocked"; emit(); return; }
    const active = () => !disposed && current === generation;
    readinessTimeout = window.setTimeout(() => {
      if (!active() || state.ready) return;
      generation++; release();
      const fallback = document.createElement("div");
      fallback.className = "stream-mount";
      mount = fallback; host.appendChild(fallback); nativeFrame(fallback);
      state.status = "blocked"; emit();
    }, 15000);
    try {
      const { Player } = api;
      const instance = new Player(target, { channel, parent: [window.location.hostname], width: "100%", height: "100%", autoplay: true, muted: state.muted, controls: false });
      player = instance;
      const on = (event: string, handler: () => void) => instance.addEventListener(event, () => { if (active()) handler(); });
      on(Player.READY, () => {
        clearTimeout(readinessTimeout);
        state.ready = true; state.status = "paused";
        instance.setVolume(state.volume / 100); instance.setMuted(state.muted);
        emit(); instance.play();
        poll = window.setInterval(sync, 1000);
      });
      on(Player.PLAY, () => { state.status = "buffering"; emit(); });
      on(Player.PLAYING, () => { state.status = "playing"; sync(); });
      on(Player.PAUSE, () => { state.status = "paused"; emit(); });
      on(Player.ENDED, () => { state.status = "ended"; emit(); });
      on(Player.OFFLINE, () => { state.status = "unconfigured"; emit(); });
      on(Player.ONLINE, () => { if (state.status === "unconfigured") { state.status = "paused"; emit(); instance.play(); } });
      on(Player.PLAYBACK_BLOCKED, () => { state.status = "blocked"; emit(); });
    } catch { release(); state.status = "error"; emit(); }
  };
  let connectionLost = !navigator.onLine;
  const offline = () => { connectionLost = true; clearTimeout(readinessTimeout); };
  const reconnect = () => {
    const interruptedPlayback = connectionLost && ["playing", "buffering", "loading", "error"].includes(state.status);
    connectionLost = false;
    if (!disposed && navigator.onLine && (!state.ready || interruptedPlayback)) void connect();
  };
  window.addEventListener("offline", offline);
  window.addEventListener("online", reconnect);
  void connect();
  return {
    togglePlayback: () => { if (state.ready && player) { if (player.isPaused() || player.getEnded()) player.play(); else player.pause(); } },
    toggleSound: () => { if (state.ready && player) { player.setMuted(!player.getMuted()); sync(); } },
    setVolume: (volume) => { if (state.ready && player) { player.setVolume(volume / 100); player.setMuted(volume === 0); sync(); } },
    retry: () => { void connect(); },
    destroy: () => { disposed = true; generation++; window.removeEventListener("offline", offline); window.removeEventListener("online", reconnect); release(); },
  };
}
