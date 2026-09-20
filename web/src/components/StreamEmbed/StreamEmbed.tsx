import { useEffect, useRef, useState } from "react";
import { createYouTubePlayer, defaultVideoId, type YouTubeHandle, type YouTubeState } from "../../media/youtubePlayer";
import { createFrogSender } from "../../api/frogColor";
import { vhsTapes } from "../../scene/scene.config";
import type { SceneHandle } from "../../scene/createScene";
import { getSceneLayout } from "../../scene/layout";
import { ScenePanels } from "./ScenePanels";
import { readPreferences, type ScenePreferences } from "../../scene/preferences";
import "../../scene/scene.css";

export const StreamEmbed = ({ videoId = defaultVideoId }: { videoId?: string }) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const screenRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<SceneHandle | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [toast, setToast] = useState("");
  const [panel, setPanel] = useState<number | null>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const [preferences, setPreferences] = useState(readPreferences);
  const preferencesRef = useRef(preferences);
  const applyPreferences = (value: ScenePreferences) => {
    preferencesRef.current = value;
    setPreferences(value);
    sceneRef.current?.setPreferences(value);
    try { localStorage.setItem("rgboo_scene_preferences", JSON.stringify(value)); } catch { /* Storage is optional. */ }
  };
  const openTape = (index: number) => {
    if (index > 2) { showComingSoon(); return; }
    returnFocus.current = rootRef.current?.querySelector<HTMLElement>(`[data-tape-index="${index}"]`) ?? null;
    sceneRef.current?.hoverTape(null);
    setPanel(index);
  };
  const showComingSoon = () => {
    clearTimeout(toastTimer.current);
    setFrogMessage("");
    setToast("Coming soon");
    toastTimer.current = setTimeout(() => setToast(""), 2400);
  };
  const playerRef = useRef<YouTubeHandle | null>(null);
  const [state, setState] = useState<YouTubeState>({ status: "loading", ready: false, muted: true, volume: 70 });
  const [frogMessage, setFrogMessage] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [sceneFailed, setSceneFailed] = useState(false);
  useEffect(() => {
    const root = rootRef.current!;
    const host = hostRef.current!;
    const controller = new AbortController();
    let playbackActive = false;
    const player = createYouTubePlayer(screenRef.current!, videoId, (next) => {
      setState(next);
      playbackActive = next.status === "playing" || next.status === "buffering";
      sceneRef.current?.setPlaying(playbackActive);
    });
    playerRef.current = player;
    const frog = createFrogSender((message) => {
      setToast("");
      setFrogMessage(message);
      clearTimeout(toastTimer.current);
      toastTimer.current = setTimeout(() => setFrogMessage(""), 3000);
    });
    const resize = () => {
      const { screen, tapes } = getSceneLayout(root.clientWidth, root.clientHeight);
      tapes.forEach((tape, index) => {
        const button = root.querySelector<HTMLElement>(`[data-tape-index="${index}"]`);
        if (button) Object.assign(button.style, { left: `${tape.x}px`, top: `${tape.y}px`, width: `${tape.width}px`, height: `${tape.height}px` });
      });
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
        if (action === "coming-soon") showComingSoon();
        if (action === "open-color") openTape(0);
        if (action === "open-links") openTape(1);
        if (action === "open-settings") openTape(2);
      });
    }).then((scene) => { if (!controller.signal.aborted) { sceneRef.current = scene ?? null; scene?.setPlaying(playbackActive); scene?.setPreferences(preferencesRef.current); } }).catch((error: unknown) => {
      if (controller.signal.aborted) return;
      console.error("Scene could not initialize", error);
      setSceneFailed(true);
    });
    return () => { clearTimeout(toastTimer.current); sceneRef.current = null; controller.abort(); frog.destroy(); observer.disconnect(); player.destroy(); playerRef.current = null; };
  }, [videoId, attempt]);
  return (
    <div ref={rootRef} className="scene-player" data-testid="stream-embed-container" data-playback={state.status} data-scene-failed={sceneFailed} data-high-contrast={preferences.highContrast} data-show-labels={preferences.showLabels} data-reduced-motion={preferences.reduceMotion}>
      <div className="scene-canvas-host" ref={hostRef} />
      <div className="scene-youtube-screen" ref={screenRef} />
      <div role="group" aria-label="VHS shelf">
        {vhsTapes.map((tape, index) => <button key={tape.id} type="button" className="vhs-hit-target" data-tape-index={index} aria-label={tape.label} aria-haspopup={index < 3 ? "dialog" : undefined} title={tape.label}
          onPointerEnter={() => sceneRef.current?.hoverTape(index)}
          onPointerLeave={(event) => { if (document.activeElement !== event.currentTarget) sceneRef.current?.hoverTape(null); }}
          onFocus={() => sceneRef.current?.hoverTape(index)} onBlur={() => sceneRef.current?.hoverTape(null)}
          onClick={() => openTape(index)}><span className="tape-label">{tape.title}</span></button>)}
      </div>
      <div className="scene-toast" role="status" aria-label="VHS notification" data-visible={Boolean(toast)}>{toast}</div>
      <ScenePanels panel={panel} onClose={() => setPanel(null)} returnFocus={returnFocus} player={playerRef} playback={state} videoId={videoId}
        preferences={preferences} onPreferences={applyPreferences} onRetry={() => setAttempt((n) => n + 1)} />
      <p className="scene-toast frog-message" data-visible={Boolean(frogMessage)} role="status" aria-label="Frog color submission">{frogMessage}</p>
    </div>
  );
};
export default StreamEmbed;
