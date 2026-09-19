import { Application, Assets, Container, Graphics, Rectangle, Sprite, type Texture } from "pixi.js";
import { layerNames, sceneArtwork, sceneConfig, tvArtwork, type SceneAction, type SceneLayer } from "./scene.config";
import { getSceneLayout } from "./layout";
import { makePlaceholder } from "./placeholders";
export interface SceneHandle { destroy: () => void }

/** Pixi owns the room; the official YouTube iframe remains a separate DOM surface. */
export async function createScene(host: HTMLElement, signal: AbortSignal, onAction: (action: SceneAction) => void): Promise<SceneHandle | undefined> {
  const app = new Application();
  await app.init({ preference: "webgl", background: sceneConfig.background, antialias: true,
    autoDensity: true, resolution: Math.min(window.devicePixelRatio || 1, 2), autoStart: false });
  if (signal.aborted) { app.destroy(true, { children: true }); return; }
  const world = app.stage.addChild(new Container({ label: "room" }));
  const layers = Object.fromEntries(layerNames.map((name) => [name, world.addChild(new Container({ label: name }))])) as Record<SceneLayer, Container>;
  const outsideMask = layers.background.addChild(new Graphics().rect(950, 125, 460, 510).fill(0xffffff));
  layers.outside.mask = outsideMask;
  const objects = new Map<string, Container>();
  let candlesLit = true;
  let hop = 0;
  const action = (name: SceneAction) => {
    if (name === "toggle-candles") {
      candlesLit = !candlesLit;
      app.canvas.dataset.candles = candlesLit ? "lit" : "dim";
      for (const [id, object] of objects) if (id.startsWith("candle")) object.alpha = candlesLit ? 1 : 0.35;
    } else if (name === "frog-hop") {
      hop = 0.5;
      app.canvas.dataset.frog = "hopping";
      onAction(name);
    } else onAction(name);
  };
  for (const art of sceneArtwork) {
    const object = layers[art.layer].addChild(new Container({ label: art.id }));
    object.position.set(art.x, art.y);
    object.addChild(makePlaceholder(art));
    object.eventMode = art.action ? "static" : "none";
    if (art.action) {
      object.hitArea = new Rectangle(0, 0, art.width, art.height);
      object.cursor = "pointer";
      object.on("pointertap", () => { app.canvas.focus({ preventScroll: true }); action(art.action!); });
    }
    objects.set(art.id, object);
  }
  const tv = app.stage.addChild(new Graphics({ label: "crt-housing" }));
  let tvSprite: Sprite | undefined;
  let disposed = false;
  const resize = () => {
    const width = Math.max(240, host.clientWidth), height = Math.max(420, host.clientHeight);
    app.renderer.resize(width, height);
    const layout = getSceneLayout(width, height);
    world.scale.set(layout.scale);
    world.position.set(layout.x, layout.y);
    const s = layout.screen;
    tv.clear().roundRect(s.x - 18, s.y - 18, s.width + 36, s.height + 96, 18).fill(0x756656)
      .roundRect(s.x - 8, s.y - 8, s.width + 16, s.height + 16, 8).fill(0x2c292a)
      .rect(s.x, s.y, s.width, s.height).fill(0x080c12);
    if (tvSprite) {
      const sx = s.width / tvArtwork.opening.width, sy = s.height / tvArtwork.opening.height;
      tvSprite.position.set(s.x - tvArtwork.opening.x * sx, s.y - tvArtwork.opening.y * sy);
      tvSprite.width = tvArtwork.width * sx;
      tvSprite.height = tvArtwork.height * sy;
    }
  };
  const observer = new ResizeObserver(resize);
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  let elapsed = 0;
  app.ticker.maxFPS = 30;
  app.ticker.add((ticker) => {
    const dt = Math.min(ticker.deltaMS / 1000, 0.1);
    if (!reducedMotion.matches) elapsed += dt;
    hop = Math.max(0, hop - dt);
    for (const art of sceneArtwork) {
      const object = objects.get(art.id)!;
      if (art.motion === "float") object.y = art.y + (reducedMotion.matches ? 0 : Math.sin(elapsed * 1.4 + art.x) * 9);
      if (art.motion === "fog") object.x = art.x + (reducedMotion.matches ? 0 : Math.sin(elapsed * 0.2 + art.y) * 24);
      if (art.id === "frog") object.y = art.y - (reducedMotion.matches ? 0 : Math.sin(hop / 0.5 * Math.PI) * 28);
    }
    app.canvas.dataset.frog = hop > 0 ? "hopping" : "resting";
  });
  const onVisibility = () => { if (document.hidden) app.stop(); else app.start(); };
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.repeat || event.ctrlKey || event.metaKey || event.altKey) return;
    const name: SceneAction | undefined = event.key === " " ? "toggle-playback"
      : event.key.toLowerCase() === "m" ? "toggle-sound"
      : event.key.toLowerCase() === "f" ? "frog-hop"
      : event.key.toLowerCase() === "l" ? "toggle-candles" : undefined;
    if (name) { event.preventDefault(); action(name); }
  };
  const destroy = () => {
    if (disposed) return;
    disposed = true;
    signal.removeEventListener("abort", destroy);
    observer.disconnect();
    document.removeEventListener("visibilitychange", onVisibility);
    app.canvas.removeEventListener("keydown", onKeyDown);
    app.destroy(true, { children: true });
  };
  signal.addEventListener("abort", destroy, { once: true });
  app.canvas.tabIndex = 0;
  app.canvas.dataset.candles = "lit";
  app.canvas.setAttribute("role", "group");
  app.canvas.setAttribute("aria-label", "Interactive scene: CRT television, moonlit window with fog, frog on the sill, floating candles and a fixed spider. Space plays or pauses, M toggles sound, F makes the frog hop and sends green to the stream, L dims the candles.");
  app.canvas.addEventListener("keydown", onKeyDown);
  document.addEventListener("visibilitychange", onVisibility);
  host.appendChild(app.canvas);
  resize(); observer.observe(host); onVisibility();
  // A failed art export keeps its placeholder; it must never remove the player.
  void Promise.all(sceneArtwork.filter((art) => art.src).map(async (art) => {
    try {
      const texture = await Assets.load<Texture>(art.src!);
      if (disposed) return;
      const object = objects.get(art.id)!;
      object.removeChildren().forEach((child) => child.destroy());
      object.addChild(new Sprite({ texture, width: art.width, height: art.height }));
    } catch (error) { console.warn(`Could not load scene art: ${art.id}`, error); }
  }));
  if (tvArtwork.src) void Assets.load<Texture>(tvArtwork.src).then((texture) => {
    if (disposed) return;
    tv.visible = false;
    tvSprite = app.stage.addChild(new Sprite({ texture, label: "crt-artwork" }));
    resize();
  }).catch((error: unknown) => console.warn("Could not load TV artwork", error));
  return { destroy };
}
