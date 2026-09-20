import { Graphics } from "pixi.js";
import type { SceneArtwork } from "./scene.config";
import { pixels, pixelLine, steppedRect } from "./pixelArt";

/** Every placeholder is authored on a coarse pixel grid, ready for sprite exports. */
export function makePlaceholder(art: SceneArtwork, options: { floorY?: number } = {}) {
  const g = new Graphics({ label: `${art.id}-placeholder` });
  const { width: w, height: h, id } = art;
  if (id === "wall") {
    const floor = options.floorY ?? h - 64;
    const panel = Math.max(0, floor - 108);
    g.rect(0, 0, w, h).fill(0x1e1a27);
    for (let x = 24; x < w; x += 96) {
      g.rect(x, 0, 3, panel).fill(0x2a2433);
      for (let y = 36; y < panel - 24; y += 80) {
        pixels(g, ["..a..", ".aba.", "ab.ba", ".aba.", "..a.."], { a: 0x342a39, b: 0x443341 }, 3, x + 38, y);
      }
    }
    // Paper bats and a corner cobweb: simple 80s Halloween decorations.
    const webSize = Math.min(150, w * 0.28);
    for (const t of [0, .33, .66, 1]) pixelLine(g, 0, 0, webSize * (1 - t), webSize * t, 0x39303f, 2);
    for (const radius of [.32, .62, 1]) {
      for (let i = 0; i < 3; i++) pixelLine(g, webSize * radius * (1 - i / 3), webSize * radius * i / 3,
        webSize * radius * (1 - (i + 1) / 3), webSize * radius * (i + 1) / 3, 0x332b3b, 2);
    }
    const garlandWidth = Math.min(w * .65, 780);
    for (let x = 40; x < garlandWidth; x += 4) {
      const y = 18 + Math.sin((x - 40) / (garlandWidth - 40) * Math.PI) * 24;
      g.rect(x, Math.round(y), 4, 1).fill(0x44343e);
    }
    for (const t of [.18, .4, .64, .86]) {
      const x = 40 + (garlandWidth - 40) * t;
      const y = 22 + Math.sin(t * Math.PI) * 24;
      pixels(g, ["x.....x.x.....x", "xx....xxx....xx", "xxxx..xxx..xxxx", ".xxxxxxxxxxxxx.", "..xxx.xxx.xxx..", "...x...x...x..."], { x: 0x362335 }, w < 480 ? 2 : 3, x - 20, y);
    }
    // Walnut panelling and a low dado rail make the stand feel grounded in a room.
    g.rect(0, panel, w, floor - panel).fill(0x281d20);
    g.rect(0, panel, w, 5).fill(0x523b2d).rect(0, panel + 5, w, 5).fill(0x211a1e);
    for (let x = 0; x < w; x += 72) {
      g.rect(x, panel + 10, 3, floor - panel - 10).fill(0x221a1c);
      g.rect(x + 4, panel + 10, 2, floor - panel - 10).fill(0x493127);
    }
    g.rect(0, floor - 6, w, 6).fill(0x6a4932).rect(0, floor, w, h - floor).fill(0x151119);
    for (let y = floor + 24; y < h; y += 28) {
      g.rect(0, y, w, 2).fill(0x2b2023);
      for (let x = (Math.floor(y / 28) % 2) * 90; x < w; x += 180) g.rect(x, y - 24, 2, 24).fill(0x302225);
    }
  } else if (id === "night-sky") {
    g.rect(0, 0, w, h).fill(0x0b0e1b);
    g.rect(0, h * 0.55, w, h * 0.45).fill(0x11182a);
    for (const [x, y] of [[40, 50], [165, 75], [320, 210], [90, 250], [395, 65]]) {
      pixels(g, [".x.", "xxx", ".x."], { x: 0x7d8c95 }, 3, x, y);
    }
    // Bare branches beyond the window; fog passes in front of them.
    pixelLine(g, w - 55, h, w - 110, h * .25, 0x201c2d, 5);
    for (const [x, y, ex, ey] of [[w - 80, h * .65, w - 175, h * .42], [w - 96, h * .43, w - 34, h * .27], [w - 100, h * .35, w - 150, h * .17]]) {
      pixelLine(g, x, y, ex, ey, 0x201c2d, 3);
    }
  } else if (id === "pumpkin") {
    for (const [spread, alpha] of [[14, .025], [8, .04], [2, .065]]) {
      g.rect(-spread, h * .2 - spread, w + spread * 2, h * .8 + spread * 2).fill({ color: 0xea762e, alpha });
    }
    pixels(g, [
      ".........ss.......", "........ss........", ".......ss.........", "....ooossooooo....",
      "..oodddoddddooo...", ".odddldodlddddoo..", "odddlldodllddddoo.",
      "oddyydodddyydadoo.", "odyyyydodyyyyddoo", "odddddoddddddddoo.",
      "oddddodyoddddddoo", "odyddyydyyddydoo.", ".odyyyyyyyyyydoo..", "..oddyddyydodoo...", "...oooooooooo....",
    ], { s: 0x526044, o: 0x522617, d: 0x9b441c, l: 0xc16629, y: 0xffcf72, a: 0x78351b }, w / 18, 0, h - w / 18 * 15);
  } else if (id === "moon") {
    const cell = w / 20;
    for (let y = 0; y < 20; y++) for (let x = 0; x < 20; x++) {
      const disc = (x - 9.5) ** 2 + (y - 9.5) ** 2 < 90;
      const shadow = (x - 13) ** 2 + (y - 6) ** 2 < 78;
      if (disc && !shadow) g.rect(x * cell, y * cell, cell, cell).fill(x < 4 ? 0x879581 : 0xb9ba98);
    }
  } else if (id.startsWith("fog")) {
    for (let i = 0; i < 4; i++) {
      steppedRect(g, i * w * 0.19, (i % 2) * 24, w * 0.42, h * 0.44, 12, i % 2 ? 0x34404e : 0x404d59);
    }
    g.alpha = 0.36;
  } else if (id === "window-frame") {
    // Only frame strips: leave the glass transparent above the sky.
    for (const [x, y, bw, bh] of [[-8, -8, w + 16, 24], [-8, h - 16, w + 16, 24], [-8, 0, 24, h], [w - 16, 0, 24, h], [w / 2 - 10, 0, 20, h], [0, h / 2 - 10, w, 20]]) {
      g.rect(x, y, bw, bh).fill(0x3b323d);
      g.rect(x, y, bw, 4).fill(0x4b3c50);
      g.rect(x, y, 4, bh).fill(0x4b3c50);
    }
  } else if (id === "curtain-left" || id === "curtain-right") {
    const right = id === "curtain-right";
    // Tied-back rose/plum curtains, with warm woven stripes and a brass tie.
    for (let row = 0; row < h; row += 8) {
      const spread = row < h * 0.56 ? w * (1 - row / h * 0.9) : w * (0.45 + (row / h - 0.56) * 0.8);
      const start = right ? w - spread : 0;
      g.rect(start, row, spread, 8).fill(0x372331);
      for (let col = 6; col < spread; col += 16) g.rect(start + col, row, 4, 8).fill(0x503244);
    }
    g.rect(right ? w * 0.42 : 0, h * 0.55, w * 0.58, 8).fill(0x96704a);
  } else if (id === "curtain-rod") {
    g.rect(0, 0, w, 6).fill(0x6a4b38);
    g.rect(0, -3, 10, 12).fill(0xa28354).rect(w - 10, -3, 10, 12).fill(0xa28354);
  } else if (id === "tea-mug") {
    const p = w / 14;
    pixels(g, ["..............", "..aaaaaaaa....", "..abbbbbbaaa..", "..abbbbbba.ba.", "..abbbbbba.ba.", "..abbbbbbaaa..", "..abbbbba.....", "...aaaaa......"], { a: 0x3e5f58, b: 0x78907d }, p, 0, h - p * 8);
    g.rect(p * 3, h - p * 7, p * 6, p).fill(0x3b2a30);
    pixelLine(g, p * 5, h - p * 10, p * 6, h - p * 12, 0xc6b6a1, p * 0.5);
  } else if (id === "window-sill") {
    g.rect(0, 0, w, h).fill(0x4b3c50).rect(0, 0, w, 6).fill(0x685366);
    g.rect(12, h, w - 24, 12).fill(0x302735);
  } else if (id === "frog") {
    pixels(g, [
      "...ooo.....ooo...", "..oggoo...ooggo..", "..ogkgoooogkgo..", "..ogggggggggggo..",
      ".ogggggggggggggo.", ".ogggggggggggggo.", ".ogggkkggkkggggo.", "..ogggkkkkggggo..",
      ".oggggllllgggggo.", "oggggllllllgggggo", "oooooollllooooooo",
    ], { o: 0x3b5648, g: 0x8fa77b, l: 0xbfca8a, k: 0x203731 }, w / 17, 0, 0);
  } else if (id === "spider") {
    g.rect(w / 2, 0, 3, h - 62).fill(0x55505f);
    pixels(g, ["xx...xx...xx...xx", "..x..xx...xx..x..", "...xxxxxxxxxx...", "....xxxxxxxx....", "...xxaxaxxaxx...", "..x.xxxxxxxx.x..", ".x...xxxxxx...x.", "x....x....x....x"], { x: 0x7c7086, a: 0x292534 }, w / 17, 0, h - 60);
  } else if (id.startsWith("candle")) {
    const size = w / 10;
    pixels(g, ["....a.....", "...aaa....", "...aba....", "..abbba...", "...aba....", "....c.....", "..dddddd..", "..deeddd.."], { a: 0xdd9460, b: 0xffe8ad, c: 0x3e3544, d: 0xe0c9a1, e: 0xffe9ba }, size);
    g.rect(size * 2, size * 8, size * 6, h - size * 8).fill(0xa18767);
    g.rect(size * 2, size * 8, size, h - size * 8).fill(0xd5b886);
    g.rect(size * 7, size * 8, size, h - size * 8).fill(0x715948);
    pixelLine(g, size * 4, size * 8, size * 4, size * 10, 0xe0c9a1, size);
  }
  return g;
}
