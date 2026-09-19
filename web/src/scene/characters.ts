import { Container, Graphics } from "pixi.js";
import { pixels, pixelLine } from "./pixelArt";

/** Small, independently animated sprite parts; final art can replace each part. */
export function createLoungingCat() {
  const root = new Container({ label: "lounging-cat" });
  const tail = root.addChild(new Graphics({ label: "cat-tail" }));
  const body = root.addChild(new Graphics({ label: "cat-body" }));
  const face = root.addChild(new Graphics({ label: "cat-face" }));
  pixels(body, [
    "..d....d.........................",
    "..dd..dd.........................",
    "..dlddld.....ddddddddddd..........",
    ".dlllllld..ddlllllllllldd.........",
    ".dlllllldddlllllllllllllld........",
    ".dllllllllllllllllllllllllld......",
    "..dllllclllllldllllldllllllld......",
    "...dcccccclllldllllldllllllld......",
    "..dcccccccclllllllllllllllld......",
    "..dddddddddddddddddddddddddd......",
  ], { d: 0x38313e, l: 0x65576f, c: 0x9b8875 }, 1, 0, -10);
  // Blue reflected light along the paws facing the screen.
  body.rect(4, -1, 23, 1).fill(0x8595aa);
  let previousPose = "";
  const update = (time: number, still: boolean) => {
    // Local y=0 is the contact plane: expand the body upward, never translate it.
    const breathScale = still ? 1 : 1 + (Math.sin(time * 1.2) + 1) * 0.012;
    body.scale.y = breathScale;
    face.scale.y = breathScale;
    const sleepyBlink = !still && time % 8 > 6.9 && time % 8 < 7.3;
    const tailFrame = still ? 0 : Math.floor(time / 0.7) % 8;
    const earTwitch = !still && time % 13 > 10.4 && time % 13 < 10.7;
    const pose = `${sleepyBlink}-${tailFrame}-${earTwitch}`;
    if (pose !== previousPose) {
      previousPose = pose;
      face.clear();
      for (const x of [3, 7]) {
        face.rect(x, -5, 2, 1).fill(sleepyBlink ? 0xd2c0b0 : 0x302a3c);
        if (sleepyBlink) face.rect(x, -6, 1, 1).fill(0x8ea5a7);
      }
      face.rect(6, -3, 1, 1).fill(0x926d77);
      if (earTwitch) face.rect(7, -11, 1, 2).fill(0x65576f);
      tail.clear();
      const rise = [0, 0, 1, 2, 2, 1, 0, 0][tailFrame];
      pixelLine(tail, 26, -2, 30, -2, 0x554958, 2);
      pixelLine(tail, 30, -2, 32, -4 - rise, 0x65576f, 2);
      tail.rect(31, -6 - rise, 2, 2).fill(0x9b8875);
    }
    return sleepyBlink ? "blinking" : earTwitch ? "ear-twitch" : "lounging";
  };
  update(0, true);
  return { root, update };
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
