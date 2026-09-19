import { useEffect, useRef, useState } from "react";
import { createYouTubePlayer, defaultVideoId, type YouTubeHandle, type YouTubeState } from "../../media/youtubePlayer";
import { createFrogSender } from "../../api/frogColor";
import { getSceneLayout } from "../../scene/layout";
import "../../scene/scene.css";

export const StreamEmbed = ({ videoId = defaultVideoId }: { videoId?: string }) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const screenRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YouTubeHandle | null>(null);
  const [state, setState] = useState<YouTubeState>({ status: "loading", ready: false, muted: true, volume: 70 });
  const [frogMessage, setFrogMessage] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [sceneFailed, setSceneFailed] = useState(false);
  useEffect(() => {
    const root = rootRef.current!;
    const host = hostRef.current!;
    const controller = new AbortController();
    const player = createYouTubePlayer(screenRef.current!, videoId, setState);
    playerRef.current = player;
    const frog = createFrogSender(setFrogMessage);
    const resize = () => {
      const { screen } = getSceneLayout(root.clientWidth, root.clientHeight);
      for (const [key, value] of Object.entries(screen)) root.style.setProperty(`--screen-${key}`, `${value}px`);
    };
    const observer = new ResizeObserver(resize);
    resize(); observer.observe(root);
    void import("../../scene/createScene").then(({ createScene }) => {
      if (controller.signal.aborted) return;
      return createScene(host, controller.signal, (action) => {
        if (action === "toggle-playback") player.togglePlayback();
        if (action === "toggle-sound") player.toggleSound();
        if (action === "frog-hop") void frog.send();
      });
    }).catch((error: unknown) => {
      if (controller.signal.aborted) return;
      console.error("Scene could not initialize", error);
      setSceneFailed(true);
    });
    return () => { controller.abort(); frog.destroy(); observer.disconnect(); player.destroy(); playerRef.current = null; };
  }, [videoId, attempt]);
  const playing = state.status === "playing" || state.status === "buffering";
  const label = state.status === "error" ? "Stream unavailable" : state.status === "unconfigured" ? "Stream offline"
    : state.status === "loading" ? "Connecting…" : state.status === "blocked" ? "Press play to watch" : state.status;
  return (
    <div ref={rootRef} className="scene-player" data-testid="stream-embed-container" data-playback={state.status} data-scene-failed={sceneFailed}>
      <div className="scene-canvas-host" ref={hostRef} />
      <div className="scene-youtube-screen" ref={screenRef} />
      <div className="tv-controls" role="group" aria-label="Television controls">
        <button type="button" onClick={() => playerRef.current?.togglePlayback()} disabled={!state.ready} aria-label={playing ? "Pause stream" : "Play stream"}>
          <span aria-hidden="true">{playing ? "Ⅱ" : "▶"}</span>
        </button>
        <button type="button" onClick={() => playerRef.current?.toggleSound()} disabled={!state.ready} aria-label={state.muted ? "Unmute stream" : "Mute stream"}>
          {state.muted ? "Sound off" : "Sound on"}
        </button>
        <input aria-label="Stream volume" type="range" min="0" max="100" value={state.volume} disabled={!state.ready} onChange={(event) => playerRef.current?.setVolume(Number(event.target.value))} />
        <span className="tv-status" role="status" aria-label="Stream status"><i data-lit={playing} aria-hidden="true" />{label}</span>
        {state.status === "error" && <button type="button" onClick={() => setAttempt((n) => n + 1)}>Retry</button>}
        <a href={`https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`} target="_blank" rel="noreferrer" aria-label="Watch stream on YouTube">YouTube ↗</a>
      </div>
      <p className="frog-message" role="status" aria-label="Frog color submission">{frogMessage}</p>
    </div>
  );
};
export default StreamEmbed;
