import { createScene as createActualScene, type SceneHandle } from "../../scene/createScene";
import { vhsTapes } from "../../scene/scene.config";
export * from "../../scene/createScene";

let staticScene = false;
export const useStaticScene = (value: boolean) => { staticScene = value; };

// Panel unit tests need a stable scene boundary, not a full software-rendered room.
// Scene integration tests continue to exercise the actual Pixi renderer.
export const createScene: typeof createActualScene = async (host, signal, onAction) => {
  if (!staticScene) return createActualScene(host, signal, onAction);
  if (signal.aborted) return;
  const canvas = document.createElement("canvas");
  canvas.width = host.clientWidth; canvas.height = host.clientHeight;
  canvas.setAttribute("role", "group"); canvas.setAttribute("aria-label", "Interactive scene test fixture");
  canvas.tabIndex = 0;
  canvas.getContext("2d")!.fillRect(0, 0, canvas.width, canvas.height);
  host.append(canvas);
  const destroy = () => { signal.removeEventListener("abort", destroy); canvas.remove(); };
  signal.addEventListener("abort", destroy, { once: true });
  return {
    destroy,
    hoverTape: (index) => { canvas.dataset.hoveredTape = index === null ? "" : vhsTapes[index].id; },
    setPlaying: (playing) => { canvas.dataset.tvPowered = String(playing); },
    setPreferences: (preferences) => { canvas.dataset.motion = preferences.reduceMotion ? "reduced" : "full"; },
    setPanelOpen: () => {},
  } satisfies SceneHandle;
};
