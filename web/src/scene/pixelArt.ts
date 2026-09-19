import { Graphics } from "pixi.js";

/** Draw authored sprite cells, with no smoothing or generated image dependency. */
export function pixels(g: Graphics, rows: string[], palette: Record<string, number>, size: number, x = 0, y = 0) {
  rows.forEach((row, j) => [...row].forEach((cell, i) => {
    if (palette[cell] !== undefined) g.rect(x + i * size, y + j * size, size, size).fill(palette[cell]);
  }));
}
export function pixelLine(g: Graphics, x1: number, y1: number, x2: number, y2: number, color: number, size = 4) {
  const steps = Math.ceil(Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1)) / size);
  for (let i = 0; i <= steps; i++) {
    const t = steps ? i / steps : 0;
    g.rect(Math.round((x1 + (x2 - x1) * t) / size) * size, Math.round((y1 + (y2 - y1) * t) / size) * size, size, size).fill(color);
  }
}
export function steppedRect(g: Graphics, x: number, y: number, w: number, h: number, cut: number, color: number) {
  g.rect(x + cut, y, w - cut * 2, h).rect(x, y + cut, w, h - cut * 2).fill(color);
}
