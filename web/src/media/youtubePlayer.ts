import type { PlaybackStatus } from "./playbackStatus";
interface YouTubePlayer {
  playVideo(): void; pauseVideo(): void; mute(): void; unMute(): void;
  setVolume(volume: number): void; getVolume(): number; isMuted(): boolean;
  getPlayerState(): number; destroy(): void;
}
interface PlayerEvent { target: YouTubePlayer; data: number }
export interface YouTubeAPI {
  Player: new (element: HTMLIFrameElement, options: { events: {
    onReady(event: PlayerEvent): void; onStateChange(event: PlayerEvent): void;
    onError(event: PlayerEvent): void; onAutoplayBlocked(event: PlayerEvent): void;
  } }) => YouTubePlayer;
}
declare global { interface Window { YT?: YouTubeAPI; onYouTubeIframeAPIReady?: () => void } }
let apiPromise: Promise<YouTubeAPI> | undefined;
export function loadYouTubeAPI(): Promise<YouTubeAPI> {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (apiPromise) return apiPromise;
  apiPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    const previous = window.onYouTubeIframeAPIReady;
    const fail = () => { clearTimeout(timeout); script.remove(); apiPromise = undefined; reject(new Error("YouTube API unavailable")); };
    const timeout = window.setTimeout(fail, 15000);
    window.onYouTubeIframeAPIReady = () => {
      clearTimeout(timeout);
      previous?.();
      if (window.YT?.Player) resolve(window.YT); else fail();
    };
    script.src = "https://www.youtube.com/iframe_api";
    script.async = true;
    script.onerror = fail;
    document.head.appendChild(script);
  });
  return apiPromise;
}
export interface YouTubeState { status: PlaybackStatus; ready: boolean; muted: boolean; volume: number }
export interface YouTubeHandle { togglePlayback(): void; toggleSound(): void; setVolume(volume: number): void; destroy(): void }
export const defaultVideoId = import.meta.env.VITE_YOUTUBE_VIDEO_ID ?? "6LVM4iQfMX4";

export function createYouTubePlayer(host: HTMLElement, videoId: string, onChange: (state: YouTubeState) => void): YouTubeHandle {
  let disposed = false, ready = false;
  let player: YouTubePlayer | undefined;
  let poll: number | undefined;
  let readinessTimeout: number | undefined;
  const state: YouTubeState = { status: videoId ? "loading" : "unconfigured", ready: false, muted: true, volume: 70 };
  const emit = () => { if (!disposed) onChange({ ...state }); };
  const iframe = document.createElement("iframe");
  iframe.title = "RGBOO live stream on YouTube";
  iframe.allow = "autoplay; encrypted-media; picture-in-picture; fullscreen";
  iframe.allowFullscreen = true;
  iframe.referrerPolicy = "strict-origin-when-cross-origin";
  const params = new URLSearchParams({ enablejsapi: "1", origin: window.location.origin, controls: "0", playsinline: "1", rel: "0" });
  const url = `https://www.youtube.com/embed/${encodeURIComponent(videoId)}?${params}`;
  const fallback = () => {
    if (disposed || ready) return;
    state.status = "error"; state.ready = false;
    // Native controls remain usable even if an extension or network blocks the JS API.
    iframe.src = url.replace("controls=0", "controls=1");
    emit();
  };
  const sync = () => {
    if (!ready || disposed || !player) return;
    state.muted = player.isMuted(); state.volume = player.getVolume(); emit();
  };
  emit();
  if (videoId) {
    iframe.src = url;
    host.appendChild(iframe);
    void loadYouTubeAPI().then((api) => {
      if (disposed) return;
      readinessTimeout = window.setTimeout(fallback, 15000);
      player = new api.Player(iframe, { events: {
        onReady: ({ target }) => {
          if (disposed) return;
          clearTimeout(readinessTimeout);
          ready = true; state.ready = true; state.status = "paused";
          target.setVolume(70); target.mute(); emit(); target.playVideo();
          poll = window.setInterval(sync, 1000);
        },
        onStateChange: ({ data }) => {
          if (disposed) return;
          state.status = ({ [-1]: "paused", 0: "ended", 1: "playing", 2: "paused", 3: "buffering", 5: "paused" } as Record<number, PlaybackStatus>)[data] ?? "loading";
          emit(); sync();
        },
        onError: () => { state.status = "error"; emit(); },
        onAutoplayBlocked: () => { state.status = "blocked"; emit(); },
      } });
    }).catch(fallback);
  }
  return {
    togglePlayback: () => { if (ready && player) { if ([1, 3].includes(player.getPlayerState())) player.pauseVideo(); else player.playVideo(); } },
    toggleSound: () => { if (ready && player) { if (player.isMuted()) player.unMute(); else player.mute(); sync(); } },
    setVolume: (volume) => { if (ready && player) { player.setVolume(volume); if (volume > 0) player.unMute(); else player.mute(); sync(); } },
    destroy: () => { disposed = true; clearInterval(poll); clearTimeout(readinessTimeout); player?.destroy(); iframe.remove(); },
  };
}
