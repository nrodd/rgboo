import { useEffect, useRef, useState } from "react";
import { createVideoPlayer, type PlaybackStatus } from "../../media/createVideoPlayer";
import { getVideoSource, type VideoSourceConfig } from "../../media/videoSource";
import type { SceneHandle } from "../../scene/createScene";
import { sceneConfig } from "../../scene/scene.config";
import "../../scene/scene.css";

const defaultSource = getVideoSource();
const statusText: Record<PlaybackStatus, string> = {
  unconfigured: "Stream offline",
  loading: "Connecting to stream…",
  playing: "Playing",
  buffering: "Buffering…",
  paused: "Paused",
  blocked: "Press play to watch",
  ended: "Stream ended",
  error: "Unable to play the stream",
};

interface StreamEmbedProps {
  className?: string;
  source?: VideoSourceConfig;
}

/** React owns controls and lifecycle; Pixi owns the artwork and video pixels. */
export const StreamEmbed = ({ className = "", source = defaultSource }: StreamEmbedProps) => {
  const hostRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<SceneHandle | undefined>(undefined);
  const playerRef = useRef<ReturnType<typeof createVideoPlayer> | undefined>(undefined);
  const [status, setStatus] = useState<PlaybackStatus>(source.url ? "loading" : "unconfigured");
  const [fallback, setFallback] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [muted, setMuted] = useState(true);
  const [effects, setEffects] = useState(() => !window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  const effectsRef = useRef(effects);
  const mutedRef = useRef(muted);

  useEffect(() => {
    effectsRef.current = effects;
    sceneRef.current?.setEffects(effects);
  }, [effects]);
  useEffect(() => {
    mutedRef.current = muted;
    playerRef.current?.setMuted(muted);
  }, [muted]);
  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const change = () => setEffects(!preference.matches);
    preference.addEventListener("change", change);
    return () => preference.removeEventListener("change", change);
  }, []);

  useEffect(() => {
    const host = hostRef.current!;
    const controller = new AbortController();
    setFallback(false);
    const player = createVideoPlayer({ url: source.url, type: source.type, loop: source.loop }, setStatus);
    player.setMuted(mutedRef.current);
    playerRef.current = player;
    void import("../../scene/createScene").then(({ createScene }) => {
      if (controller.signal.aborted) return;
      return createScene(host, player.video, controller.signal);
    }).then((scene) => {
      if (controller.signal.aborted) return;
      sceneRef.current = scene;
      scene?.setEffects(effectsRef.current);
    }).catch((error: unknown) => {
      if (controller.signal.aborted) return;
      console.error("Scene could not initialize", error);
      setFallback(true);
      // A native player remains usable if WebGL or an artwork asset fails.
      player.video.controls = true;
      player.video.className = "scene-native-video";
      host.replaceChildren(player.video);
    });
    return () => {
      controller.abort();
      sceneRef.current = undefined;
      playerRef.current = undefined;
      player.destroy();
      host.replaceChildren();
    };
  }, [source.url, source.type, source.loop, attempt]);

  const canPlay = Boolean(source.url);
  const retry = () => { setMuted(true); setAttempt((previous) => previous + 1); };

  return (
    <section data-testid="stream-embed-container" className={`scene-player ${className}`} aria-label="Live stream scene">
      <div className="scene-viewport" style={{ aspectRatio: `${sceneConfig.width} / ${sceneConfig.height}` }}>
        <div className="scene-canvas-host" ref={hostRef} />
        {status !== "playing" && <div className="scene-status" role="status">{statusText[status]}</div>}
      </div>
      <div className="scene-controls">
        <span role="status" className="scene-playback-status">{status === "playing" ? statusText[status] : ""}</span>
        <button type="button" disabled={!canPlay} onClick={() => {
          if (status === "error" || status === "ended") retry();
          else if (status === "playing") playerRef.current?.pause();
          else void playerRef.current?.play();
        }}>
          {status === "playing" ? "Pause" : status === "error" || status === "ended" ? "Reconnect" : "Play"}
        </button>
        <button type="button" disabled={!canPlay} aria-pressed={!muted} onClick={() => setMuted((previous) => !previous)}>
          {muted ? "Unmute" : "Mute"}
        </button>
        <button type="button" disabled={fallback} aria-pressed={effects && !fallback} onClick={() => setEffects((previous) => !previous)}>
          CRT effects
        </button>
      </div>
    </section>
  );
};

export default StreamEmbed;
