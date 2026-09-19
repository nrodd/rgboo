import type Hls from "hls.js";
import type { VideoSourceConfig } from "./videoSource";

export type PlaybackStatus = "unconfigured" | "loading" | "playing" | "buffering" | "paused" | "blocked" | "ended" | "error";

/** Owns transport and playback. It knows nothing about Pixi or the scene. */
export function createVideoPlayer(
  source: VideoSourceConfig,
  onStatus: (status: PlaybackStatus) => void,
) {
  const video = document.createElement("video");
  video.crossOrigin = "anonymous";
  video.muted = true;
  video.playsInline = true;
  video.loop = source.loop;
  video.preload = "auto";
  let destroyed = false;
  let hls: Hls | undefined;
  const listeners: Array<[string, EventListener]> = [];
  const report = (status: PlaybackStatus) => { if (!destroyed) onStatus(status); };
  const listen = (name: string, status: PlaybackStatus) => {
    const listener = () => report(status);
    video.addEventListener(name, listener);
    listeners.push([name, listener]);
  };
  listen("playing", "playing");
  listen("waiting", "buffering");
  listen("pause", "paused");
  listen("ended", "ended");
  listen("error", "error");

  const play = async () => {
    if (destroyed || !source.url) return;
    try {
      await video.play();
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      report(error instanceof DOMException && error.name === "NotAllowedError" ? "blocked" : "error");
    }
  };

  const start = async () => {
    if (!source.url) { report("unconfigured"); return; }
    report("loading");
    const isHls = source.type === "hls" || (source.type === "auto" && /\.m3u8(?:[?#]|$)/i.test(source.url));
    try {
      if (!isHls || video.canPlayType("application/vnd.apple.mpegurl")) {
        video.src = source.url;
        await play();
        return;
      }
      const { default: HlsPlayer } = await import("hls.js");
      if (destroyed) return;
      if (!HlsPlayer.isSupported()) { report("error"); return; }
      hls = new HlsPlayer({ lowLatencyMode: true });
      hls.on(HlsPlayer.Events.MANIFEST_PARSED, () => { void play(); });
      hls.on(HlsPlayer.Events.ERROR, (_event, data) => {
        if (data.fatal) {
          hls?.destroy();
          hls = undefined;
          report("error");
        }
      });
      hls.loadSource(source.url);
      hls.attachMedia(video);
    } catch {
      report("error");
    }
  };
  void start();

  return {
    video,
    play,
    pause: () => video.pause(),
    setMuted: (muted: boolean) => { video.muted = muted; },
    destroy() {
      destroyed = true;
      for (const [name, listener] of listeners) video.removeEventListener(name, listener);
      hls?.destroy();
      video.pause();
      video.removeAttribute("src");
      video.load();
    },
  };
}
