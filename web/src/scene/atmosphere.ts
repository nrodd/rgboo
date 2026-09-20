import { Container, Graphics } from "pixi.js";
import type { getSceneLayout } from "./layout";
import type { Bounds } from "./scene.config";
import { sceneConfig } from "./scene.config";

/** Pixel rain stays inside the existing outside-window mask. */
export function createRain() {
  const root = new Container({ label: "window-rain" });
  root.eventMode = "none";
  const drops = Array.from({ length: 48 }, (_, i) => {
    const drop = root.addChild(new Graphics());
    const far = i % 3 === 0;
    drop.rect(0, 0, far ? 2 : 3, far ? 10 : 18).fill({ color: 0xb1c9d5, alpha: far ? 0.13 : 0.25 });
    if (!far) drop.rect(-2, 14, 2, 6).fill({ color: 0xb1c9d5, alpha: 0.14 });
    return { drop, x: (i * 137) % 460, y: (i * 83) % 520, speed: far ? 100 : 185 };
  });
  const update = (time: number) => drops.forEach(({ drop, x, y, speed }) => {
    drop.position.set(950 + Math.floor(((x - time * 18) % 460 + 460) % 460 / 3) * 3,
      112 + Math.floor(((y + time * speed) % 520) / 3) * 3);
  });
  update(0);
  return { root, update };
}

function halo(g: Graphics, x: number, y: number, width: number, height: number, color: number, strength: number) {
  for (let i = 6; i >= 1; i--) {
    const spread = i * 8;
    g.rect(x - spread, y - spread, width + spread * 2, height + spread * 2).fill({ color, alpha: strength / (i + 4) });
  }
}

/** Authored room lighting, not sampled YouTube frames. No effect touches the iframe. */
export function createRoomLight() {
  const wall = new Graphics({ label: "tv-wall-spill" });
  const reflected = new Graphics({ label: "tv-reflections" });
  const candle = new Graphics({ label: "candlelight" });
  wall.eventMode = reflected.eventMode = candle.eventMode = "none";
  let power = 0.4;
  let target = 0.4;
  const setPlaying = (playing: boolean) => { target = playing ? 1 : 0.4; };
  const resize = ({ screen: s, stand }: ReturnType<typeof getSceneLayout>, candles: Bounds[]) => {
    wall.clear(); reflected.clear(); candle.clear();
    const color = sceneConfig.ambience.color;
    halo(wall, s.x - 12, s.y - 12, s.width + 24, s.height + 52, color, 0.09);
    // Tight edge reflections reduce the hard boundary between the video and its housing.
    for (const [thickness, alpha] of [[8, 0.035], [4, 0.06], [1, 0.13]]) {
      reflected.rect(s.x - thickness, s.y, thickness, s.height)
        .rect(s.x + s.width, s.y, thickness, s.height)
        .rect(s.x, s.y - thickness, s.width, thickness)
        .rect(s.x, s.y + s.height, s.width, thickness).fill({ color, alpha });
    }
    reflected.rect(s.x, s.y - 22, s.width, 3).fill({ color, alpha: 0.1 });
    reflected.rect(stand.x + 4, stand.y, stand.width - 8, 4).fill({ color, alpha: 0.15 });
    reflected.rect(stand.x + 18, stand.y + 14, stand.width - 36, 50).fill({ color, alpha: 0.025 });
    for (const b of candles) halo(candle, b.x + b.width * 0.35, b.y + 6, b.width * 0.3, 18, 0xf39b4b, 0.32);
  };
  const update = (dt: number, time: number, still: boolean, candlesLit: boolean) => {
    power = still ? target : power + (target - power) * Math.min(1, dt * 2);
    const pulse = still ? 1 : 0.94 + Math.sin(time * 0.57) * 0.035 + Math.sin(time * 1.2) * 0.025;
    wall.alpha = reflected.alpha = power * pulse;
    candle.alpha = (candlesLit ? 1 : 0.12) * (still ? 1 : 0.93 + Math.sin(time * 3.2) * 0.04 + Math.sin(time * 5.3) * 0.03);
  };
  return { wall, reflected, candle, resize, update, setPlaying };
}
