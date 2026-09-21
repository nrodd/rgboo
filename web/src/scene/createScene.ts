import { Application, Assets, Container, Graphics, Rectangle, Sprite, Texture } from "pixi.js";
import { pixels } from "./pixelArt";
import { layerNames, sceneArtwork, sceneConfig, tvArtwork, vhsTapes, windowOpening, type SceneAction, type SceneLayer } from "./scene.config";
import { getSceneLayout } from "./layout";
import { drawTelevision, drawTape, drawTapeGlow } from "./television";
import { createLoungingCat, createIdleFrog } from "./characters";
import { createRain, createRoomLight } from "./atmosphere";
import { drawRoomRug } from "./roomDecor";
import type { ScenePreferences } from "./preferences";
import { makePlaceholder } from "./placeholders";
export interface SceneHandle { destroy: () => void; hoverTape: (index: number | null) => void; setPlaying: (playing: boolean) => void; setPreferences: (preferences: ScenePreferences) => void }

/** Pixi owns the room; the official YouTube iframe remains a separate DOM surface. */
export async function createScene(host: HTMLElement, signal: AbortSignal, onAction: (action: SceneAction) => void): Promise<SceneHandle | undefined> {
  const app = new Application();
  await app.init({ preference: "webgl", background: sceneConfig.background, antialias: false, roundPixels: true,
    autoDensity: true, resolution: 1, autoStart: false, preserveDrawingBuffer: true });
  if (signal.aborted) { app.destroy(true, { children: true }); return; }
  const backdrop = app.stage.addChild(new Container({ label: "backdrop" }));
  const rug = app.stage.addChild(new Graphics({ label: "woven-rug" }));
  rug.eventMode = "none";
  const light = createRoomLight();
  app.stage.addChild(light.wall, light.candle);
  const world = app.stage.addChild(new Container({ label: "room" }));
  const layers = Object.fromEntries(layerNames.map((name) => [name, world.addChild(new Container({ label: name }))])) as Record<SceneLayer, Container>;
  const outsideMask = layers.background.addChild(new Graphics().rect(windowOpening.x, windowOpening.y, windowOpening.width, windowOpening.height).fill(0xffffff));
  layers.outside.mask = outsideMask;
  const objects = new Map<string, Container>();
  const positions = new Map(sceneArtwork.map((art) => [art.id, { x: art.x, y: art.y }]));
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
    const object = (art.id === "wall" ? backdrop : layers[art.layer]).addChild(new Container({ label: art.id }));
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
  const frogArt = sceneArtwork.find((art) => art.id === "frog")!;
  const frog = frogArt.src ? undefined : createIdleFrog(frogArt.width);
  if (frog) {
    objects.get("frog")!.removeChildren().forEach((child) => child.destroy());
    objects.get("frog")!.addChild(frog.root);
  }
  const rain = createRain();
  layers.outside.addChild(rain.root);
  const tv = app.stage.addChild(new Graphics({ label: "crt-housing" }));
  app.stage.addChild(light.reflected, layers.foreground);
  const cat = createLoungingCat();
  app.stage.addChild(cat.root);
  void cat.ready.catch((error: unknown) => console.warn("Could not load cat artwork", error));
  const setPlaying = (playing: boolean) => {
    light.setPlaying(playing);
    app.canvas.dataset.tvPowered = String(playing);
  };
  setPlaying(false);
  let hoveredTape: number | null = null;
  const hoverTape = (index: number | null) => {
    hoveredTape = index;
    app.canvas.dataset.hoveredTape = index === null ? "" : vhsTapes[index].id;
  };
  const tapes = vhsTapes.map((tape, index) => {
    const object = app.stage.addChild(new Container({ label: tape.id }));
    const glow = object.addChild(new Graphics());
    glow.alpha = 0;
    const body = object.addChild(new Graphics());
    object.eventMode = "static";
    object.cursor = "pointer";
    object.on("pointerenter", () => hoverTape(index));
    object.on("pointerleave", () => hoverTape(null));
    object.on("pointertap", () => onAction((["open-color", "open-links", "open-settings", "coming-soon", "coming-soon"] as SceneAction[])[index]));
    return { object, glow, body };
  });
  let tvSprite: Sprite | undefined;
  let disposed = false;
  const resize = () => {
    if (disposed || !host.clientWidth || !host.clientHeight) return;
    const width = Math.max(240, host.clientWidth), height = Math.max(540, host.clientHeight);
    app.renderer.resize(width, height);
    const layout = getSceneLayout(width, height);
    world.scale.set(layout.scale);
    world.position.set(layout.x, layout.y);
    layers.foreground.scale.set(layout.scale);
    layers.foreground.position.set(layout.x, layout.y);
    const spider = objects.get("spider")!;
    spider.position.set(width < 760 ? (24 - layout.x) / layout.scale : 105, width < 760 ? -layout.y / layout.scale : 0);
    const wall = objects.get("wall")!;
    const wallArt = sceneArtwork.find((art) => art.id === "wall")!;
    if (!wallArt.src) {
      wall.removeChildren().forEach((child) => child.destroy());
      wall.addChild(makePlaceholder({ ...wallArt, width, height }, { floorY: Math.min(height - 48, layout.stand.y + layout.stand.height - 18) }));
    } else {
      const image = wall.children[0];
      if (image) { image.width = width; image.height = height; }
    }
    const s = layout.screen;
    const pumpkin = objects.get("pumpkin")!;
    const pumpkinScale = width < 760 ? .48 : .78;
    pumpkin.scale.set(pumpkinScale / layout.scale);
    pumpkin.position.set(((width < 760 ? Math.max(8, layout.stand.x) : Math.max(12, layout.stand.x - 94)) - layout.x) / layout.scale,
      ((width < 760 ? layout.stand.y + layout.stand.height - 6 : layout.stand.y + layout.stand.height - 64) - layout.y) / layout.scale);
    drawRoomRug(rug, layout.rug);
    drawTelevision(tv, layout);
    cat.root.scale.set(layout.cat.pixelSize);
    cat.root.position.set(Math.round(layout.cat.x - 30), layout.cat.y);
    const candles = sceneArtwork.filter((art) => art.id.startsWith("candle")).map((art, index) => {
      // In portrait layouts the candles float in the free end of the shelf.
      const position = width < 760 ? {
        x: ((width < 360 ? s.x + (index === 0 ? 20 : 46) : s.x + s.width - (index === 0 ? 64 : 38)) - layout.x) / layout.scale,
        y: ((width < 360 ? s.y - (index === 0 ? 62 : 78) : layout.stand.y + (index === 0 ? 32 : 18)) - layout.y) / layout.scale,
      } : { x: art.x, y: art.y };
      positions.set(art.id, position);
      objects.get(art.id)!.position.set(position.x, position.y);
      return { x: layout.x + position.x * layout.scale, y: layout.y + position.y * layout.scale,
        width: art.width * layout.scale, height: art.height * layout.scale };
    });
    light.resize(layout, candles);
    tapes.forEach(({ object, glow, body }, index) => {
      const bounds = layout.tapes[index];
      object.position.set(bounds.x, bounds.y);
      object.hitArea = new Rectangle(0, 0, bounds.width, bounds.height);
      drawTape(body, bounds, vhsTapes[index].color, index);
      drawTapeGlow(glow, bounds, vhsTapes[index].color);
    });
    if (tvSprite) {
      const sx = s.width / tvArtwork.opening.width, sy = s.height / tvArtwork.opening.height;
      tvSprite.position.set(s.x - tvArtwork.opening.x * sx, s.y - tvArtwork.opening.y * sy);
      tvSprite.width = tvArtwork.width * sx;
      tvSprite.height = tvArtwork.height * sy;
    }
  };
  // A resize clears WebGL's drawing buffer. Paint the new geometry immediately,
  // including while native window resizing temporarily pauses animation frames.
  const redraw = () => { resize(); if (!disposed) app.render(); };
  const observer = new ResizeObserver(redraw);
  let reduceMotion = false;
  const setPreferences = (preferences: ScenePreferences) => { reduceMotion = preferences.reduceMotion; };
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  let elapsed = 0;
  app.ticker.maxFPS = 30;
  app.ticker.add((ticker) => {
    const dt = Math.min(ticker.deltaMS / 1000, 0.1);
    const still = reduceMotion || reducedMotion.matches;
    if (!still) elapsed += dt;
    app.canvas.dataset.motion = still ? "reduced" : "full";
    app.canvas.dataset.cat = cat.update(elapsed, still);
    rain.update(still ? 0 : elapsed);
    light.update(dt, elapsed, still, candlesLit);
    hop = Math.max(0, hop - dt);
    tapes.forEach(({ glow }, index) => {
      const target = hoveredTape === index ? 1 : 0;
      glow.alpha = still ? target : glow.alpha + (target - glow.alpha) * Math.min(1, dt * 12);
    });
    for (const art of sceneArtwork) {
      const object = objects.get(art.id)!;
      if (art.motion === "float") object.y = positions.get(art.id)!.y + (still ? 0 : Math.sin(elapsed * 1.15 + art.x * 0.01) * 3);
      if (art.motion === "fog") object.x = art.x + (still ? 0 : Math.sin(elapsed * 0.2 + art.y) * 24);
      if (art.id === "frog") {
        const phase = elapsed % 14;
        const idleHop = phase > 7 && phase < 7.5 ? Math.sin((phase - 7) / 0.5 * Math.PI) * 14 : 0;
        const height = still ? 0 : Math.max(idleHop, Math.sin(hop / 0.5 * Math.PI) * 28);
        object.y = art.y - height;
        app.canvas.dataset.frog = frog?.update(elapsed, still, height > 0) ?? (height > 0 ? "hopping" : "resting");
      }
    }
  });
  const onVisibility = () => { if (document.hidden) app.stop(); else { redraw(); app.start(); } };
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
  app.canvas.setAttribute("aria-label", "Interactive scene: CRT television, rainy moonlit window with fog, animated frog on the sill, a lounging cat on the TV, clustered candles, a glowing pumpkin, paper bats, a fixed spider and VHS tapes on the television stand. Space plays or pauses, M toggles sound, F makes the frog hop and sends green to the stream, L dims the candles.");
  app.canvas.addEventListener("keydown", onKeyDown);
  document.addEventListener("visibilitychange", onVisibility);
  host.appendChild(app.canvas);
  redraw(); observer.observe(host); onVisibility();
  // A failed art export keeps its placeholder; it must never remove the player.
  void Promise.all(sceneArtwork.filter((art) => art.src).map(async (art) => {
    try {
      const texture = await Assets.load<Texture>(art.src!);
      texture.source.scaleMode = "nearest";
      if (disposed) return;
      const object = objects.get(art.id)!;
      object.removeChildren().forEach((child) => child.destroy());
      const cropped = art.crop ? new Texture({ source: texture.source, frame: new Rectangle(art.crop.x, art.crop.y, art.crop.width, art.crop.height) }) : texture;
      if (art.crop) object.on("destroyed", () => cropped.destroy());
      const sprite = object.addChild(new Sprite({ texture: cropped }));
      if (art.id.startsWith("candle")) {
        // The supplied wax exports are unlit. Keep a separate flame above the wick,
        // and scale the cropped art uniformly so its pixels retain their proportions.
        const flameHeight = 32;
        sprite.scale.set(Math.min(art.width / cropped.width, (art.height - flameHeight) / cropped.height));
        sprite.position.set((art.width - sprite.width) / 2, flameHeight);
        const flame = object.addChild(new Graphics({ label: "candle-flame" }));
        pixels(flame, ["...a...", "..aaa..", "..aba..", ".abbba.", "..aba..", "...b...", "...w...", "...w..."],
          { a: 0xdd9460, b: 0xffe8ad, w: 0x30202b }, 4, art.width / 2 - 14, 0);
      } else { sprite.width = art.width; sprite.height = art.height; }
      if (art.id === "wall") resize();
      if (!disposed) app.render();
    } catch (error) { console.warn(`Could not load scene art: ${art.id}`, error); }
  }));
  if (tvArtwork.src) void Assets.load<Texture>(tvArtwork.src).then((texture) => {
    if (disposed) return;
    texture.source.scaleMode = "nearest";
    // Keep the separately drawn stand and tapes when replacing the TV casing.
    tv.visible = true;
    tvSprite = app.stage.addChildAt(new Sprite({ texture, label: "crt-artwork" }), app.stage.getChildIndex(light.reflected));
    resize();
  }).catch((error: unknown) => console.warn("Could not load TV artwork", error));
  return { destroy, hoverTape, setPlaying, setPreferences };
}
