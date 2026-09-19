import { Application, Assets, Container, Graphics, Sprite, Texture, VideoSource } from "pixi.js";
import { CRTFilter } from "pixi-filters/crt";
import { layerNames, sceneArtwork, sceneConfig, type SceneLayer } from "./scene.config";

export interface SceneHandle {
  setEffects: (enabled: boolean) => void;
  destroy: () => void;
}

/** Owns rendering only. Add scene objects and animation here. */
export async function createScene(
  host: HTMLElement,
  video: HTMLVideoElement,
  signal: AbortSignal,
): Promise<SceneHandle | undefined> {
  const app = new Application();
  await app.init({
    preference: "webgl",
    background: sceneConfig.background,
    antialias: true,
    autoDensity: true,
    resolution: Math.min(window.devicePixelRatio || 1, 2),
    autoStart: false,
  });
  if (signal.aborted) { app.destroy(true, { children: true }); return; }

  const world = new Container({ label: "world" });
  app.stage.addChild(world);
  const layers = Object.fromEntries(layerNames.map((name) => {
    const layer = new Container({ label: name });
    world.addChild(layer);
    return [name, layer];
  })) as Record<SceneLayer, Container>;
  // Decorative layers do not need pointer hit testing.
  world.eventMode = "none";
  const screen = sceneConfig.screen;
  if (sceneConfig.showPlaceholders) {
    layers.props.addChild(new Graphics()
      .roundRect(screen.x - 32, screen.y - 32, screen.width + 64, screen.height + 64, 40)
      .fill(0x39343e));
  }
  const display = new Container({ label: "crt-display" });
  display.position.set(screen.x, screen.y);
  layers.screen.addChild(display);
  display.addChild(new Graphics().rect(0, 0, screen.width, screen.height).fill(0x07090b));
  const mask = new Graphics().roundRect(0, 0, screen.width, screen.height, screen.radius).fill(0xffffff);
  display.addChild(mask);
  display.mask = mask;
  const crt = new CRTFilter(sceneConfig.crt);
  display.filters = [crt];
  let texture: Texture | undefined;
  let sprite: Sprite | undefined;
  let disposed = false;

  const fitVideo = () => {
    if (disposed || !video.videoWidth || !video.videoHeight) return;
    if (!texture) {
      texture = new Texture({ source: new VideoSource({ resource: video, autoPlay: false }) });
      sprite = new Sprite(texture);
      display.addChild(sprite);
    }
    const scale = Math.min(screen.width / video.videoWidth, screen.height / video.videoHeight);
    sprite!.width = video.videoWidth * scale;
    sprite!.height = video.videoHeight * scale;
    sprite!.position.set((screen.width - sprite!.width) / 2, (screen.height - sprite!.height) / 2);
  };
  const resize = () => {
    const width = Math.max(1, host.clientWidth);
    const height = Math.max(1, host.clientHeight);
    app.renderer.resize(width, height);
    const scale = Math.min(width / sceneConfig.width, height / sceneConfig.height);
    world.scale.set(scale);
    world.position.set((width - sceneConfig.width * scale) / 2, (height - sceneConfig.height * scale) / 2);
  };
  const observer = new ResizeObserver(resize);
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  let effects = !reducedMotion.matches;
  const setEffects = (enabled: boolean) => {
    effects = enabled;
    display.filters = enabled ? [crt] : [];
  };
  setEffects(effects);
  app.ticker.maxFPS = 60;
  app.ticker.add((ticker) => {
    if (effects && !reducedMotion.matches) {
      crt.time += ticker.deltaMS / 1000;
      crt.seed = Math.random();
    }
  });
  const onVisibility = () => { if (document.hidden) app.stop(); else app.start(); };
  document.addEventListener("visibilitychange", onVisibility);
  const destroy = () => {
    if (disposed) return;
    disposed = true;
    signal.removeEventListener("abort", destroy);
    observer.disconnect();
    document.removeEventListener("visibilitychange", onVisibility);
    video.removeEventListener("loadeddata", fitVideo);
    video.removeEventListener("resize", fitVideo);
    app.stop();
    app.destroy(true, { children: true });
    // Art uses the shared Assets cache; only this scene's video texture is owned here.
    texture?.destroy(true);
    crt.destroy();
  };
  signal.addEventListener("abort", destroy, { once: true });

  try {
    // Resolve together, then insert in manifest order (network order must not reorder art).
    const textures = await Promise.all(sceneArtwork.map((art) => Assets.load<Texture>(art.src)));
    if (disposed) return;
    sceneArtwork.forEach((art, index) => {
      const object = new Sprite({ texture: textures[index], label: art.id });
      object.position.set(art.x, art.y);
      object.width = art.width;
      object.height = art.height;
      object.rotation = art.rotation ?? 0;
      object.alpha = art.alpha ?? 1;
      layers[art.layer].addChild(object);
    });
    video.addEventListener("loadeddata", fitVideo);
    video.addEventListener("resize", fitVideo);
    fitVideo();
    app.canvas.setAttribute("aria-hidden", "true");
    host.appendChild(app.canvas);
    resize();
    observer.observe(host);
    onVisibility();
    return { setEffects, destroy };
  } catch (error) {
    destroy();
    throw error;
  }
}
