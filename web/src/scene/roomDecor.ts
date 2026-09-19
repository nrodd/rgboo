import { Graphics } from "pixi.js";
import type { Bounds } from "./scene.config";
import { pixels, steppedRect } from "./pixelArt";

/** A faded woven rug beneath the stand, drawn in viewport coordinates. */
export function drawRoomRug(g: Graphics, { x, y, width, height }: Bounds) {
  g.clear();
  steppedRect(g, x, y, width, height, 8, 0x2b2027);
  steppedRect(g, x + 6, y + 4, width - 12, height - 8, 4, 0x61404d);
  g.rect(x + 12, y + 9, width - 24, height - 18).fill(0x304943);
  g.rect(x + 12, y + 9, width - 24, 2).fill(0x796446);
  g.rect(x + 12, y + height - 11, width - 24, 2).fill(0x796446);
  for (const row of [y + 16, y + height - 32]) {
    for (let i = x + 22; i < x + width - 28; i += 32) {
      pixels(g, ["..a..", ".aba.", "abcba", ".aba.", "..a.."], { a: 0x5c614b, b: 0x80624b, c: 0x4f3345 }, 3, i, row);
    }
  }
  for (let i = x + 10; i < x + width - 8; i += 8) g.rect(i, y + height - 1, 3, 4).fill(0x6c5344);
}
