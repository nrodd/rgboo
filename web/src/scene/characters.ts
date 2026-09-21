import { Assets, Container, Graphics, Rectangle, Sprite, Texture } from "pixi.js";
import catAwakeUrl from "../assets/cat_awake.png";
import catAwakeWagUrl from "../assets/cat_awake_wag.png";
import catDefaultUrl from "../assets/cat_default.png";
import catDefaultWagUrl from "../assets/cat_default_wag.png";
import { pixels } from "./pixelArt";

/** The resting and awake exports have different sizes but share a resting plane. */
export function createLoungingCat() {
  const root = new Container({ label: "lounging-cat" });
  root.eventMode = "none";
  const body = root.addChild(new Sprite({ label: "cat-body" }));
  const tail = root.addChild(new Sprite({ label: "cat-tail" }));
  body.anchor.set(0, 1);
  let frames: { body: Texture; tail: Texture }[] = [];
  const baseScale = 68;
  const update = (time: number, still: boolean) => {
    const blink = !still && time % 20 > 18.6 && time % 20 < 18.9;
    const awake = !still && time % 20 > 17;
    const wagging = !still && time % 20 > 12 && time % 20 < 17;
    const wagPose = wagging ? (Math.floor(time / 2.5) % 2 === 0 ? 2 : 3) : awake && !blink ? 1 : 0;
    const frame = frames[wagPose] ?? frames[0];
    if (frame) {
      body.texture = frame.body; tail.texture = frame.tail;
      body.scale.set(baseScale / 80);
      tail.scale.set(baseScale / 80);
    }
    // Only the body expands upward; the paws and hanging tail stay in place.
    body.scale.y = body.scale.x * (still ? 1 : 1 + (Math.sin(time * 1.2) + 1) * .008);
    return blink ? "blinking" : wagging ? "wagging" : awake ? "awake" : "lounging";
  };
  const ready = Promise.all([
    Assets.load<Texture>(catDefaultUrl),
    Assets.load<Texture>(catAwakeUrl),
    Assets.load<Texture>(catDefaultWagUrl),
    Assets.load<Texture>(catAwakeWagUrl),
  ]).then(([rest, awake, restWag, awakeWag]) => {
    if (root.destroyed) return;
    rest.source.scaleMode = awake.source.scaleMode = restWag.source.scaleMode = awakeWag.source.scaleMode = "nearest";
    const poses = [
      { texture: rest, x: 7, y: 12, width: 53, contact: 43, bottom: 59 },
      { texture: awake, x: 7, y: 12, width: 53, contact: 43, bottom: 59 },
      { texture: restWag, x: 7, y: 12, width: 53, contact: 43, bottom: 59 },
      { texture: awakeWag, x: 7, y: 12, width: 53, contact: 43, bottom: 59 },
    ];
    frames = poses.map(({ texture, x, y, width, contact, bottom }) => {
      const source = texture.source;
      return {
        body: new Texture({ source, frame: new Rectangle(x, y, width, contact - y) }),
        tail: new Texture({ source, frame: new Rectangle(x, contact, width, bottom - contact) }),
      };
    });
    update(0, true);
  });
  root.on("destroyed", () => frames.forEach((frame) => { frame.body.destroy(); frame.tail.destroy(); }));
  return { root, update, ready };
}

export function createIdleFrog(width: number) {
  const root = new Container({ label: "frog-idle-sprite" });
  const body = root.addChild(new Graphics());
  const eyes = root.addChild(new Graphics());
  const throat = root.addChild(new Graphics());
  const cell = width / 17;
  pixels(body, [
    "...ooo.....ooo...", "..oggoo...ooggo..", "..oggggoooggggo..", "..ogggggggggggo..",
    ".ogggggggggggggo.", ".ogggggggggggggo.", ".ogggkkggkkggggo.", "..ogggkkkkggggo..",
    ".oggggllllgggggo.", "oggggllllllgggggo", "oooooollllooooooo",
  ], { o: 0x3b5648, g: 0x728660, l: 0x99a86d, k: 0x203731 }, cell);
  let previousPose = "";
  const update = (time: number, still: boolean, hopping: boolean) => {
    const blink = !still && time % 5.7 > 4.9 && time % 5.7 < 5.15;
    const looking = !still && time % 12 > 6 && time % 12 < 8;
    const puff = !still && !hopping && Math.sin(time * 1.6) > 0.7;
    const pose = `${blink}-${looking}-${puff}`;
    if (pose !== previousPose) {
      previousPose = pose;
      eyes.clear(); throat.clear();
      for (const x of [4, 11]) {
        eyes.rect((x + (looking ? 0.35 : 0)) * cell, (blink ? 2.5 : 2) * cell, cell, blink ? cell * 0.4 : cell).fill(0x203731);
      }
      if (puff) throat.rect(6 * cell, 8 * cell, 4 * cell, 2 * cell).fill(0xb3b881);
    }
    return hopping ? "hopping" : blink ? "blinking" : looking ? "watching-rain" : puff ? "breathing" : "resting";
  };
  update(0, true, false);
  return { root, update };
}
