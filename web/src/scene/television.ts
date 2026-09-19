import { Graphics } from "pixi.js";
import type { getSceneLayout } from "./layout";
import type { Bounds } from "./scene.config";
import { pixelLine, pixels, steppedRect } from "./pixelArt";

export function drawTelevision(g: Graphics, { screen: s, stand, cat }: ReturnType<typeof getSceneLayout>) {
  g.clear();
  const cx = Math.round(s.x + s.width * 0.52);
  // Rabbit ears are behind the casing, built from square pixels.
  pixelLine(g, cx - 4, s.y - 24, cx - 65, s.y - 82, 0x797579);
  pixelLine(g, cx + 4, s.y - 24, cx + 74, s.y - 94, 0x9b9393);
  g.rect(cx - 68, s.y - 86, 8, 8).fill(0xb4a58f).rect(cx + 72, s.y - 98, 8, 8).fill(0xb4a58f);
  steppedRect(g, cx - 20, s.y - 32, 40, 16, 4, 0x2c2323);
  // Dark side, thick plastic shell, bevel, and a fully unobscured video opening.
  steppedRect(g, s.x - 18, s.y - 22, s.width + 36, s.height + 98, 10, 0x21191b);
  steppedRect(g, s.x - 18, s.y - 22, s.width + 28, s.height + 90, 8, 0x594132);
  g.rect(s.x - 10, s.y - 22, s.width + 12, 4).fill(0x88664a);
  g.rect(s.x - 18, s.y - 14, 4, s.height + 68).fill(0x74553d);
  steppedRect(g, s.x - 8, s.y - 8, s.width + 16, s.height + 16, 4, 0x211b1d);
  g.rect(s.x - 4, s.y - 4, s.width + 8, s.height + 8).fill(0x0d0c10);
  g.rect(s.x, s.y, s.width, s.height).fill(0x080c12);
  // Layered walnut shading makes the lower control fascia feel recessed.
  for (const [offset, color] of [[10, 0x543c2f], [28, 0x50382c], [46, 0x4a3329], [62, 0x402c25]]) {
    g.rect(s.x - 10, s.y + s.height + offset, s.width + 20, 14).fill(color);
  }
  g.rect(s.x - 10, s.y + s.height + 9, s.width + 20, 1).fill(0x76553d);
  // A woven runner under the cat, a woodgrain side and small period color stripes.
  const runnerX = Math.max(s.x, cat.x - 8);
  const runnerWidth = Math.min(s.x + s.width - runnerX, cat.pixelSize * 29 + 10);
  g.rect(runnerX, s.y - 22, runnerWidth, 4).fill(0x405c53);
  for (let x = runnerX + 4; x < runnerX + runnerWidth - 4; x += 8) {
    g.rect(x, s.y - 22, 2, 4).fill(0x8e7d63);
    g.rect(x, s.y - 18, 2, 3).fill(0x5f7968);
  }
  for (let y = s.y + 16; y < s.y + s.height - 16; y += 36) {
    g.rect(s.x - 15, y, 2, 20).fill(0x422b20);
    g.rect(s.x - 12, y + 9, 2, 14).fill(0x75533a);
  }
  for (const [i, color] of [0xa66c4b, 0x9a8156, 0x55786b].entries()) {
    g.rect(s.x + 5 + i * 12, s.y + s.height + 61, 10, 3).fill(color);
  }
  for (let x = s.x + s.width - 76; x < s.x + s.width - 8; x += 8) {
    g.rect(x, s.y + s.height + 61, 4, 4).fill(0x201819);
  }
  // Feet sit directly on the stand.
  for (const x of [s.x + 16, s.x + s.width - 44]) g.rect(x, s.y + s.height + 76, 28, 12).fill(0x1c171e);
  g.rect(stand.x, stand.y, stand.width, 12).fill(0x54382b);
  g.rect(stand.x, stand.y, stand.width, 4).fill(0x805a3b);
  g.rect(stand.x + 8, stand.y + 12, stand.width - 16, 68).fill(0x17131d);
  g.rect(stand.x + 16, stand.y + 16, stand.width - 32, 4).fill(0x100e15);
  for (const x of [stand.x + 4, stand.x + stand.width - 16]) {
    g.rect(x, stand.y + 12, 12, stand.height).fill(0x38261f);
    g.rect(x, stand.y + 12, 4, stand.height).fill(0x68482f);
  }
  g.rect(stand.x, stand.y + 80, stand.width, 12).fill(0x54382b);
  g.rect(stand.x, stand.y + 80, stand.width, 4).fill(0x795337);
  for (let x = stand.x + 30; x < stand.x + stand.width - 20; x += 112) g.rect(x, stand.y + 7, 32, 2).fill(0x38261f);
}

export function drawTape(g: Graphics, b: Bounds, color: number, index: number) {
  g.clear();
  // Upright VHS sleeves: colored spines, paper title strips and worn lower edges.
  steppedRect(g, 0, 0, b.width, b.height, 2, 0x101018);
  g.rect(2, 2, b.width - 4, b.height - 3).fill(color);
  g.rect(2, 2, 3, b.height - 3).fill({ color: 0xffffff, alpha: 0.1 });
  g.rect(b.width - 5, 2, 3, b.height - 3).fill({ color: 0x131018, alpha: 0.45 });
  g.rect(5, 5, b.width - 11, 4).fill(0x25202a);
  g.rect(7, 14, b.width - 15, b.height - 32).fill(0xb3a285);
  // Small title-like ink marks run down each spine, rather than exposed tape reels.
  const inkX = Math.floor(b.width / 2) - 3;
  for (let y = 18; y < b.height - 22; y += 7) {
    g.rect(inkX, y, 4 + ((y + index) % 3), 2).fill(0x493c3b);
  }
  g.rect(5, b.height - 12, b.width - 11, 7).fill(0x29212b);
  for (let i = 0; i <= index; i++) g.rect(7 + i * 3, b.height - 10, 1, 3).fill(0xaa9474);
  g.rect(3, b.height - 3, b.width - 6, 2).fill(0x17151c);
}

export function drawTapeGlow(g: Graphics, b: Bounds, color: number) {
  g.clear();
  for (const [spread, alpha] of [[8, 0.035], [5, 0.07], [2, 0.18]]) {
    g.rect(-spread, -spread, b.width + spread * 2, b.height + spread * 2).fill({ color, alpha });
  }
  // Small square highlights keep the halo consistent with the sprite style.
  pixels(g, ["xx", "x."], { x: color }, 2, -3, -3);
}
