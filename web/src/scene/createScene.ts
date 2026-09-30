import { frogFrameAt } from "./frogAnimation";
import { Application, Assets, Container, Graphics, Rectangle, Sprite, Texture } from "pixi.js";
import spiderWebUrl from "../assets/spiderweb.webp";
import { createRain, createRoomLight } from "./atmosphere";
import { createIdleFrog, createLoungingCat } from "./characters";
import { getSceneLayout } from "./layout";
import { artFrames } from "./artAssets";
import { makePlaceholder } from "./placeholders";
import type { ScenePreferences } from "./preferences";
import { drawRoomRug } from "./roomDecor";
import { layerNames, sceneArtwork, sceneConfig, tvArtwork, vhsTapes, windowOpening, type SceneAction, type SceneLayer } from "./scene.config";
import { drawSettingsSpine, drawTape, drawTapeGlow, drawTelevision } from "./television";
export interface SceneHandle { destroy: () => void; hoverTape: (index: number | null) => void; setPlaying: (playing: boolean) => void; setPreferences: (preferences: ScenePreferences) => void }

/** Pixi owns the room; the official YouTube iframe remains a separate DOM surface. */
export async function createScene(host: HTMLElement, signal: AbortSignal, onAction: (action: SceneAction) => void): Promise<SceneHandle | undefined> {
  const app = new Application();
  await app.init({ preference: "webgl", background: sceneConfig.background, antialias: false, roundPixels: true,
    autoDensity: true, resolution: 1, autoStart: false, preserveDrawingBuffer: true });
  if (signal.aborted) { app.destroy(true, { children: true }); return; }
  const backdrop = app.stage.addChild(new Container({ label: "backdrop" }));
  const spiderWeb = backdrop.addChild(new Sprite({ label: "spider-web" }));
  spiderWeb.anchor.set(0, 0);
  spiderWeb.position.set(0, 0);
  spiderWeb.eventMode = "none";
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
  backdrop.addChild(spiderWeb);
  const frogArt = sceneArtwork.find((art) => art.id === "frog")!;
  const frog = frogArt.src || frogArt.frames ? undefined : createIdleFrog(frogArt.width);
  if (frog) {
    objects.get("frog")!.removeChildren().forEach((child) => child.destroy());
    objects.get("frog")!.addChild(frog.root);
  }
  const rain = createRain();
  if (!sceneArtwork.some((art) => art.id === "rain")) layers.outside.addChild(rain.root);
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
    object.on("pointertap", () => onAction((["open-color", "open-links", "open-settings", "coming-soon"] as SceneAction[])[index]));
    const sprite = object.addChild(new Sprite({ label: `${tape.id}-art` }));
    sprite.visible = false;
    return { object, glow, body, sprite, textures: [] as Texture[], updateLabel: undefined as ((frame: number) => void) | undefined };
  });
  let tvSprite: Sprite | undefined;
  const animatedArt = new Map<string, { sprite: Sprite; textures: Texture[]; frameIndex: number; elapsed: number; frameDelays: number[] }>();
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
    const spiderArt = sceneArtwork.find((art) => art.id === "spider")!;
    spider.position.set(
      width < 760 ? (spiderArt.x - layout.x / layout.scale) / layout.scale : spiderArt.x,
      width < 760 ? (-layout.y / layout.scale) : 0,
    );
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
    tv.visible = !tvSprite;
    cat.root.scale.set(layout.cat.pixelSize);
    cat.root.position.set(Math.round(layout.cat.x - 30), layout.cat.y);
    const ghostArt = sceneArtwork.find((art) => art.id === "ghost")!;
    const ghost = objects.get("ghost")!;
    ghost.scale.set(width < 760 ? 60 / ghostArt.width / layout.scale : 1);
    const ghostPosition = width < 760
      ? { x: (width - 72 - layout.x) / layout.scale, y: (layout.stand.y + layout.stand.height + 6 - layout.y) / layout.scale }
      : { x: ghostArt.x, y: ghostArt.y };
    positions.set("ghost", ghostPosition);
    ghost.position.set(ghostPosition.x, ghostPosition.y);
    const candles = sceneArtwork.filter((art) => art.id.startsWith("candle")).map((art, index) => {
      // On phones, candles sit on the rug, leaving the logo and window clear.
      const position = width < 760 ? {
        x: ((layout.stand.x + layout.stand.width * (index === 0 ? .38 : .48)) - layout.x) / layout.scale,
        y: ((layout.stand.y + layout.stand.height + 42 - art.height * layout.scale) - layout.y) / layout.scale,
      } : { x: art.x, y: art.y };
      positions.set(art.id, position);
      objects.get(art.id)!.position.set(position.x, position.y);
      return { x: layout.x + position.x * layout.scale, y: layout.y + position.y * layout.scale,
        width: art.width * layout.scale, height: art.height * layout.scale };
    });
    light.resize(layout, candles);
    tapes.forEach(({ object, glow, body, sprite }, index) => {
      const bounds = layout.tapes[index];
      object.position.set(bounds.x, bounds.y);
      object.hitArea = new Rectangle(0, 0, bounds.width, bounds.height);
      drawTape(body, bounds, vhsTapes[index].color, index);
      drawTapeGlow(glow, bounds, vhsTapes[index].color);
      if (sprite.visible) {
        const scale = Math.min(bounds.width / sprite.texture.width, bounds.height / sprite.texture.height);
        sprite.scale.set(scale);
        sprite.position.set((bounds.width - sprite.width) / 2, bounds.height - sprite.height);
      }
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
    tapes.forEach(({ glow, sprite, textures, updateLabel }, index) => {
      const target = hoveredTape === index ? 1 : 0;
      if (textures.length) {
        const frame = target ? 1 + (still ? 0 : Math.floor(elapsed * 8) % (textures.length - 1)) : 0;
        sprite.texture = textures[frame];
        updateLabel?.(frame);
      }
      glow.alpha = still ? target : glow.alpha + (target - glow.alpha) * Math.min(1, dt * 12);
    });
    for (const art of sceneArtwork) {
      const object = objects.get(art.id)!;
      if (art.motion === "float") object.y = positions.get(art.id)!.y + (still ? 0 : Math.sin(elapsed * 1.15 + art.x * 0.01) * 3);
      if (art.motion === "fog") object.x = art.x + (still ? 0 : Math.sin(elapsed * 0.2 + art.y) * 24);
      if (art.id === "frog") {
        const height = still ? 0 : Math.sin(hop / 0.5 * Math.PI) * 28;
        object.y = art.y - height;
        app.canvas.dataset.frog = frog?.update(elapsed, still, height > 0) ?? (height > 0 ? "hopping" : "resting");
      }
      if (art.id === "ghost") {
        const cycle = (elapsed % 180);
        let fade = 0;
        if (cycle <= 5) {
          fade = cycle / 5;
        } else if (cycle <= 55) {
          fade = 1;
        } else if (cycle <= 60) {
          fade = (60 - cycle) / 5;
        }
        object.alpha = fade;
        object.x = positions.get(art.id)!.x + Math.sin(elapsed * 0.5) * 10;
        object.y = positions.get(art.id)!.y + Math.sin(elapsed * 1.1) * 12;
      }
    }
    for (const [id, animation] of animatedArt) {
      if (id === "frog") {
        animation.frameIndex = frogFrameAt(elapsed, still);
        animation.sprite.texture = animation.textures[animation.frameIndex];
        app.canvas.dataset.frogFrame = String(animation.frameIndex);
        continue;
      }
      if (still) continue;
      animation.elapsed += dt;
      const frameDelay = animation.frameDelays[animation.frameIndex] ?? 0.18;
      if (animation.elapsed >= frameDelay) {
        animation.elapsed = 0;
        animation.frameIndex = (animation.frameIndex + 1) % animation.textures.length;
        animation.sprite.texture = animation.textures[animation.frameIndex];
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
  void Assets.load<Texture>(spiderWebUrl).then((texture) => {
    if (disposed) return;
    texture.source.scaleMode = "nearest";
    spiderWeb.texture = texture;
    spiderWeb.width = 256;
    spiderWeb.height = 256;
  }).catch((error: unknown) => console.warn("Could not load spider web art", error));
  // A failed art export keeps its placeholder; it must never remove the player.
  void Promise.all(sceneArtwork.filter((art) => art.src || art.frames).map(async (art) => {
    try {
      const sources = art.frames && art.frames.length > 0 ? art.frames : [art.src!];
      const textures = await Promise.all(sources.map(async (src) => {
        const texture = await Assets.load<Texture>(src);
        texture.source.scaleMode = "nearest";
        return texture;
      }));
      if (disposed) return;
      const object = objects.get(art.id)!;
      object.removeChildren().forEach((child) => child.destroy());
      const primary = textures[0];
      const cropped = art.crop ? new Texture({ source: primary.source, frame: new Rectangle(art.crop.x, art.crop.y, art.crop.width, art.crop.height) }) : primary;
      if (art.crop) object.on("destroyed", () => cropped.destroy());
      const sprite = object.addChild(new Sprite({ texture: cropped }));
      if (art.frames && art.frames.length > 1) {
        const frameDelays = art.id === "spider" ? [3.6, 1.2, 1.2, 3.6] : Array(textures.length).fill(0.18);
        animatedArt.set(art.id, { sprite, textures: textures.map((texture) => art.crop ? new Texture({ source: texture.source, frame: new Rectangle(art.crop.x, art.crop.y, art.crop.width, art.crop.height) }) : texture), frameIndex: 0, elapsed: 0, frameDelays });
        object.on("destroyed", () => {
          if (art.crop) for (const texture of animatedArt.get(art.id)?.textures ?? []) texture.destroy();
          animatedArt.delete(art.id);
        });
      }
      if (art.id.startsWith("candle")) {
        // The supplied wax exports are unlit. Keep a separate flame above the wick,
        // and scale the cropped art uniformly so its pixels retain their proportions.
        const flameHeight = 32;
        sprite.scale.set(Math.min(art.width / cropped.width, (art.height - flameHeight) / cropped.height));
        sprite.position.set((art.width - sprite.width) / 2, flameHeight);
        const flame = object.addChild(new Sprite({ label: "candle-flame" }));
        void Promise.all(artFrames(art.id === "candle-right" ? "flame_green" : "flame").map((url) => Assets.load<Texture>(url))).then((textures) => {
          if (disposed) return;
          textures.forEach((texture) => { texture.source.scaleMode = "nearest"; });
          flame.texture = textures[0];
          flame.width = 40; flame.height = 40;
          flame.position.set(art.width / 2 - 20, -6);
          animatedArt.set(`${art.id}-flame`, { sprite: flame, textures, frameIndex: 0, elapsed: 0, frameDelays: Array(8).fill(.12) });
        }).catch((error: unknown) => console.warn("Could not load flame artwork", error));
      } else if (art.frames && art.frames.length > 1) {
        const scale = Math.min(art.width / cropped.width, art.height / cropped.height);
        sprite.scale.set(scale);
        sprite.position.set((art.width - cropped.width * scale) / 2, (art.height - cropped.height * scale) / 2);
      } else { sprite.width = art.width; sprite.height = art.height; }
      if (art.id === "wall") resize();
      if (!disposed) app.render();
    } catch (error) { console.warn(`Could not load scene art: ${art.id}`, error); }
  }));
  tapes.forEach(({ body, sprite, textures }, index) => {
    const tape = vhsTapes[index];
    void Promise.all([tape.src, ...tape.frames].map((url) => Assets.load<Texture>(url))).then((loaded) => {
      if (disposed) return;
      loaded.forEach((texture) => {
        texture.source.scaleMode = "nearest";
        textures.push(new Texture({ source: texture.source, frame: index >= 3 ? new Rectangle(1, 22, 30, 10) : new Rectangle(11, 5, index === 2 ? 9 : 10, 27) }));
      });
      sprite.texture = textures[0]; sprite.visible = true; body.visible = false;
      if (index === 2) tapes[index].updateLabel = drawSettingsSpine(sprite.addChild(new Graphics({ label: "settings-spine-label" })));
      sprite.on("destroyed", () => textures.forEach((texture) => texture.destroy()));
      redraw();
    }).catch((error: unknown) => console.warn("Could not load tape artwork", error));
  });
  if (tvArtwork.src) void Assets.load<Texture>(tvArtwork.src).then((texture) => {
    if (disposed) return;
    texture.source.scaleMode = "nearest";
    // Preserve the full export: the books and shelf are authored in the PNG.
    tv.visible = false;
    tvSprite = app.stage.addChildAt(new Sprite({ texture: new Texture({ source: texture.source, frame: new Rectangle(0, 0, tvArtwork.width, tvArtwork.height) }), label: "crt-artwork" }), app.stage.getChildIndex(light.reflected));
    const casingTexture = tvSprite.texture;
    tvSprite.on("destroyed", () => casingTexture.destroy());
    redraw();
  }).catch((error: unknown) => console.warn("Could not load TV artwork", error));
  return { destroy, hoverTape, setPlaying, setPreferences };
}
