import type { PlaybackStatus } from "./playbackStatus";
interface YouTubePlayer {
  playVideo(): void; pauseVideo(): void; mute(): void; unMute(): void;
  setVolume(volume: number): void; getVolume(): number; isMuted(): boolean;
  getPlayerState(): number; destroy(): void;
}
interface PlayerEvent { target: YouTubePlayer; data: number }
export interface YouTubeAPI {
  Player: new (element: HTMLIFrameElement, options: { host?: string; events: {
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
export interface YouTubeState { status: PlaybackStatus; ready: boolean; muted: boolean; volume: number; errorCode?: number }
export interface YouTubeHandle { togglePlayback(): void; toggleSound(): void; setVolume(volume: number): void; retry(): void; destroy(): void }

export function youtubeWatchUrl(source: string) {
  return source.startsWith("channel:")
    ? `https://www.youtube.com/channel/${encodeURIComponent(source.slice(8))}/live`
    : `https://www.youtube.com/watch?v=${encodeURIComponent(source)}`;
}

export function createYouTubePlayer(host: HTMLElement, videoId: string, onChange: (state: YouTubeState) => void): YouTubeHandle {
  let disposed = false, generation = 0, automaticRetries = 0;
  let player: YouTubePlayer | undefined;
  let iframe: HTMLIFrameElement | undefined;
  let poll: number | undefined, readinessTimeout: number | undefined, retryTimer: number | undefined;
  const state: YouTubeState = { status: videoId ? "loading" : "unconfigured", ready: false, muted: false, volume: 70 };
  const emit = () => { if (!disposed) onChange({ ...state }); };
  const sync = () => {
    if (!state.ready || disposed || !player) return;
    state.muted = player.isMuted(); state.volume = player.getVolume(); emit();
  };
  const release = () => {
    clearInterval(poll); clearTimeout(readinessTimeout); clearTimeout(retryTimer);
    // A broken external player must not prevent removing its iframe.
    try { player?.destroy(); } catch { /* The fresh iframe can still reconnect. */ }
    player = undefined; iframe?.remove(); iframe = undefined;
  };
  const connect = async () => {
    if (disposed) return;
    const current = ++generation;
    release();
    state.ready = false; state.errorCode = undefined;
    state.status = videoId ? "loading" : "unconfigured";
    emit();
    if (!videoId) return;
    // Wait for the controller before navigating the frame. An effect cleaned up
    // during Strict Mode startup must never start an abandoned embed request.
    let api: YouTubeAPI | undefined;
    try { api = await loadYouTubeAPI(); } catch { /* Native controls remain available. */ }
    if (disposed || current !== generation) return;
    const frame = document.createElement("iframe");
    iframe = frame;
    frame.title = "RGBOO live stream on YouTube";
    frame.allow = "autoplay; encrypted-media; picture-in-picture; fullscreen";
    frame.allowFullscreen = true;
    frame.referrerPolicy = "strict-origin-when-cross-origin";
    const params = new URLSearchParams({ enablejsapi: "1", origin: window.location.origin, autoplay: "1", mute: state.muted ? "1" : "0", controls: "0", playsinline: "1", rel: "0" });
    const channel = videoId.startsWith("channel:") ? videoId.slice(8) : undefined;
    if (channel) params.set("channel", channel);
    // Use YouTube's privacy-enhanced embed domain.
    const url = `https://www.youtube-nocookie.com/embed/${channel ? "live_stream" : encodeURIComponent(videoId)}?${params}`;
    const active = () => !disposed && current === generation;
    const fallback = () => {
      if (!active() || state.ready) return;
      if (automaticRetries++ === 0) { void connect(); return; }
      // Release the stalled controller before installing a standalone player.
      // Never navigate a frame still owned by an API instance.
      generation++; release();
      const nativeFrame = frame.cloneNode(false) as HTMLIFrameElement;
      nativeFrame.removeAttribute("id");
      const nativeUrl = new URL(url);
      nativeUrl.searchParams.set("controls", "1");
      nativeUrl.searchParams.set("enablejsapi", "0");
      nativeFrame.src = nativeUrl.href;
      iframe = nativeFrame; host.appendChild(nativeFrame);
      state.status = "blocked"; state.ready = false; emit();
    };
    frame.src = api ? url : url.replace("controls=0", "controls=1").replace("enablejsapi=1", "enablejsapi=0");
    host.appendChild(frame);
    emit();
    if (!api) { state.status = "blocked"; emit(); return; }
    try {
      readinessTimeout = window.setTimeout(fallback, 15000);
      player = new api.Player(frame, { host: "https://www.youtube-nocookie.com", events: {
        onReady: ({ target }) => {
          if (!active()) return;
          clearTimeout(readinessTimeout);
          state.ready = true; state.status = "paused"; state.errorCode = undefined;
          target.setVolume(state.volume);
          if (state.muted) target.mute(); else target.unMute();
          emit(); target.playVideo();
          poll = window.setInterval(sync, 1000);
        },
        onStateChange: ({ data }) => {
          if (!active()) return;
          state.status = ({ [-1]: "paused", 0: "ended", 1: "playing", 2: "paused", 3: "buffering", 5: "paused" } as Record<number, PlaybackStatus>)[data] ?? "loading";
          emit(); sync();
        },
        onError: ({ data }) => {
          if (!active()) return;
          clearInterval(poll); clearTimeout(readinessTimeout);
          state.status = "error"; state.ready = false; state.errorCode = data; emit();
          // Retry one transient HTML5 player failure, never embedding/permission errors.
          if (data === 5 && automaticRetries++ === 0) retryTimer = window.setTimeout(connect, 1500);
        },
        onAutoplayBlocked: () => { if (active()) { state.status = "blocked"; emit(); } },
      } });
    } catch { fallback(); }
  };
  let connectionLost = !navigator.onLine;
  const offline = () => { connectionLost = true; clearTimeout(readinessTimeout); clearTimeout(retryTimer); };
  const reconnect = () => {
    const interruptedPlayback = connectionLost && ["playing", "buffering", "loading", "error"].includes(state.status);
    connectionLost = false;
    if (!disposed && navigator.onLine && (!state.ready || interruptedPlayback)) { automaticRetries = 0; void connect(); }
  };
  window.addEventListener("offline", offline);
  window.addEventListener("online", reconnect);
  void connect();
  return {
    togglePlayback: () => { if (state.ready && player) { if ([1, 3].includes(player.getPlayerState())) player.pauseVideo(); else player.playVideo(); } },
    toggleSound: () => { if (state.ready && player) { if (player.isMuted()) player.unMute(); else player.mute(); sync(); } },
    setVolume: (volume) => { if (state.ready && player) { player.setVolume(volume); if (volume > 0) player.unMute(); else player.mute(); sync(); } },
    retry: () => { automaticRetries = 0; void connect(); },
    destroy: () => { disposed = true; generation++; window.removeEventListener("offline", offline); window.removeEventListener("online", reconnect); release(); },
  };
}
