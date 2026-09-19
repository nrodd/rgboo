import { Graphics } from "pixi.js";
import type { SceneArtwork } from "./scene.config";

/** Deliberately simple geometry: each drawing is replaced independently by final art. */
export function makePlaceholder(art: SceneArtwork) {
  const g = new Graphics({ label: `${art.id}-placeholder` });
  const { width: w, height: h, id } = art;
  const edge = 0x716675;
  if (id === "wall") {
    g.rect(0, 0, w, h).fill(0x22232e);
    for (let x = 40; x < w; x += 100) g.rect(x, 0, 2, h).fill({ color: 0xa99b99, alpha: 0.035 });
    g.rect(0, h - 55, w, 55).fill(0x191b24);
  } else if (id === "night-sky") {
    g.rect(0, 0, w, h).fill(0x101b30);
    for (const [x, y] of [[40, 50], [165, 75], [320, 210], [90, 250], [395, 65]]) g.circle(x, y, 2).fill(0xa8bac8);
  } else if (id === "moon") {
    g.circle(w / 2, h / 2, w / 2).fill(0xd9ddc3);
    g.circle(w * 0.69, h * 0.35, w * 0.44).fill(0x101b30);
  } else if (id.startsWith("fog")) {
    for (let i = 0; i < 4; i++) g.ellipse(w * (0.15 + i * 0.24), h * (0.4 + i % 2 * 0.2), w * 0.25, h * 0.32).fill({ color: 0x90a2ad, alpha: 0.12 });
  } else if (id === "window-frame") {
    g.rect(0, 0, w, h).stroke({ color: edge, width: 20 });
    g.rect(w / 2 - 7, 0, 14, h).fill(edge);
    g.rect(0, h / 2 - 7, w, 14).fill(edge);
  } else if (id === "window-sill") {
    g.roundRect(0, 0, w, h, 4).fill(0x8b7c87);
    g.rect(12, h, w - 24, 12).fill(0x3b3547);
  } else if (id === "frog") {
    g.ellipse(w / 2, h * 0.64, w * 0.43, h * 0.35).fill(0x8fa77b);
    for (const x of [w * 0.25, w * 0.75]) {
      g.circle(x, h * 0.28, h * 0.23).fill(0x9db688);
      g.circle(x, h * 0.24, 4).fill(0x242c29);
    }
    g.moveTo(w * 0.37, h * 0.62).quadraticCurveTo(w * 0.5, h * 0.75, w * 0.63, h * 0.62).stroke({ color: 0x344a38, width: 3 });
  } else if (id === "spider") {
    g.moveTo(w / 2, 0).lineTo(w / 2, h - 35).stroke({ color: 0x9d96a1, width: 2 });
    for (const side of [-1, 1]) for (let i = 0; i < 4; i++) {
      g.moveTo(w / 2, h - 28).lineTo(w / 2 + side * 22, h - 50 + i * 13).lineTo(w / 2 + side * 34, h - 44 + i * 13).stroke({ color: 0xaaa0a3, width: 3 });
    }
    g.ellipse(w / 2, h - 27, 13, 18).fill(0xaaa0a3);
  } else if (id.startsWith("candle")) {
    g.roundRect(w * 0.2, 45, w * 0.6, h - 45, 5).fill(0xd2bda1);
    g.ellipse(w / 2, 45, w * 0.3, 7).fill(0xeee0bf);
    g.moveTo(w / 2, 45).lineTo(w / 2, 34).stroke({ color: 0x494050, width: 3 });
    g.ellipse(w / 2, 23, 9, 19).fill(0xf5bf78);
    g.ellipse(w / 2, 27, 4, 10).fill(0xffebbe);
  }
  return g;
}
