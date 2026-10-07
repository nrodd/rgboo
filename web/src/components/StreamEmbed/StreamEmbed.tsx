import { BrandLogo } from "../BrandLogo/BrandLogo";
import { useEffect, useRef, useState } from "react";
import { createTwitchPlayer, type TwitchHandle, type TwitchState } from "../../media/twitchPlayer";
import { createFrogSender } from "../../api/frogColor";
import { tvArtwork, vhsTapes } from "../../scene/scene.config";
import type { SceneHandle } from "../../scene/createScene";
import { getSceneLayout } from "../../scene/layout";
import { ScenePanels } from "./ScenePanels";
import { readPreferences, type ScenePreferences } from "../../scene/preferences";
import "../../scene/scene.css";

// Follow the channel across broadcasts; keep the source here rather than in environment configuration.
const twitchChannel = "na10_dev";

export const StreamEmbed = ({ channel = twitchChannel }: { channel?: string }) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const screenRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<SceneHandle | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [submitAttempt, setSubmitAttempt] = useState(0);
  const [panel, setPanel] = useState<number | null>(null);
  const panelRef = useRef(panel);
  panelRef.current = panel;
  useEffect(() => { sceneRef.current?.setPanelOpen(panel !== null); }, [panel]);
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
    returnFocus.current = rootRef.current?.querySelector<HTMLElement>(`[data-tape-index="${index}"]`) ?? null;
    sceneRef.current?.hoverTape(null);
    setPanel((current) => index === 3 ? 0 : current === index ? null : index);
    if (index === 3) setSubmitAttempt((value) => value + 1);
  };
  const playerRef = useRef<TwitchHandle | null>(null);
  const [state, setState] = useState<TwitchState>({ status: "loading", ready: false, muted: false, volume: 70 });
  const [frogMessage, setFrogMessage] = useState("");
  const [sceneFailed, setSceneFailed] = useState(false);
  useEffect(() => {
    const root = rootRef.current!;
    const host = hostRef.current!;
    const controller = new AbortController();
    let playbackActive = false;
    const player = createTwitchPlayer(screenRef.current!, channel, (next) => {
      setState(next);
      playbackActive = next.status === "playing" || next.status === "buffering";
      sceneRef.current?.setPlaying(playbackActive);
    });
    playerRef.current = player;
    const frog = createFrogSender((message) => {
      setFrogMessage(message);
      clearTimeout(toastTimer.current);
      toastTimer.current = setTimeout(() => setFrogMessage(""), 3000);
    });
    const resize = () => {
      const { screen, tapes, logo } = getSceneLayout(root.clientWidth, root.clientHeight);
      tapes.forEach((tape, index) => {
        const button = root.querySelector<HTMLElement>(`[data-tape-index="${index}"]`);
        if (button) Object.assign(button.style, { left: `${tape.x}px`, top: `${tape.y}px`, width: `${tape.width}px`, height: `${tape.height}px` });
      });
      root.style.setProperty("--screen-corner-x", `${10 * screen.width / tvArtwork.opening.width}px`);
      root.style.setProperty("--screen-corner-y", `${10 * screen.height / tvArtwork.opening.height}px`);
      for (const [key, value] of Object.entries(logo)) root.style.setProperty(`--logo-${key}`, `${value}px`);
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
        if (action === "open-submit") openTape(3);
        if (action === "open-color") openTape(0);
        if (action === "open-links") openTape(1);
        if (action === "open-settings") openTape(2);
      });
    }).then((scene) => { if (!controller.signal.aborted) { sceneRef.current = scene ?? null; scene?.setPlaying(playbackActive); scene?.setPreferences(preferencesRef.current); scene?.setPanelOpen(panelRef.current !== null); } }).catch((error: unknown) => {
      if (controller.signal.aborted) return;
      console.error("Scene could not initialize", error);
      setSceneFailed(true);
    });
    return () => { clearTimeout(toastTimer.current); sceneRef.current = null; controller.abort(); frog.destroy(); observer.disconnect(); player.destroy(); playerRef.current = null; };
  }, [channel]);
  return (
    <div ref={rootRef} className="scene-player" data-testid="stream-embed-container" data-playback={state.status} data-scene-failed={sceneFailed} data-high-contrast={preferences.highContrast} data-show-labels={preferences.showLabels} data-reduced-motion={preferences.reduceMotion}>
      <div className="scene-canvas-host" ref={hostRef} />
      <div className="scene-youtube-screen" ref={screenRef} />
      <BrandLogo />
      <div role="group" aria-label="VHS shelf">
        {vhsTapes.map((tape, index) => <button key={tape.id} type="button" className="vhs-hit-target" data-tape-index={index} aria-label={tape.label} aria-haspopup="dialog" title={tape.label}
          onPointerEnter={() => sceneRef.current?.hoverTape(index)}
          onPointerLeave={(event) => { if (document.activeElement !== event.currentTarget) sceneRef.current?.hoverTape(null); }}
          onFocus={() => sceneRef.current?.hoverTape(index)} onBlur={() => sceneRef.current?.hoverTape(null)}
          onClick={() => openTape(index)}><span className="tape-label">{tape.title}</span></button>)}
      </div>
      <ScenePanels submitAttempt={submitAttempt} panel={panel} onSelectTape={openTape} onClose={() => setPanel(null)} returnFocus={returnFocus} player={playerRef} playback={state} channel={channel}
        preferences={preferences} onPreferences={applyPreferences} />
      <p className="scene-toast frog-message" data-visible={Boolean(frogMessage)} role="status" aria-label="Frog color submission">{frogMessage}</p>
    </div>
  );
};
export default StreamEmbed;
