import { Assets, Container, Graphics, Rectangle, Sprite, Texture } from "pixi.js";
import { pixels } from "./pixelArt";
import catDefaultUrl from "../assets/cat_default.png";
import catAwakeUrl from "../assets/cat_awake.png";

/** Original 64px exports; both poses share the same paw contact row (43). */
export function createLoungingCat() {
  const root = new Container({ label: "lounging-cat" });
  root.eventMode = "none";
  const body = root.addChild(new Sprite({ label: "cat-body" }));
  const tail = root.addChild(new Sprite({ label: "cat-tail" }));
  const unit = 34 / 53;
  body.scale.set(unit);
  tail.scale.set(unit);
  body.anchor.set(0, 1);
  let frames: { body: Texture; tail: Texture }[] = [];
  const update = (time: number, still: boolean) => {
    const blink = !still && time % 8 > 6.9 && time % 8 < 7.3;
    const awake = !still && time % 20 > 17;
    const frame = frames[blink ? 1 : awake ? 2 : 0];
    if (frame) { body.texture = frame.body; tail.texture = frame.tail; }
    // Only the body expands upward; the paws and hanging tail stay in place.
    body.scale.y = unit * (still ? 1 : 1 + (Math.sin(time * 1.2) + 1) * .008);
    return blink ? "blinking" : awake ? "awake" : "lounging";
  };
  const ready = Promise.all([Assets.load<Texture>(catDefaultUrl), Assets.load<Texture>(catAwakeUrl)]).then(([rest, awake]) => {
    if (root.destroyed) return;
    rest.source.scaleMode = awake.source.scaleMode = "nearest";
    const poses: [Texture, number][] = [[rest, 0], [rest, 64], [awake, 0]];
    frames = poses.map(([texture, y]) => {
      const source = texture.source;
      return {
        body: new Texture({ source, frame: new Rectangle(7, y + 12, 53, 31) }),
        tail: new Texture({ source, frame: new Rectangle(7, y + 43, 53, 16) }),
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
