/** One breathing tick is half a second; wake briefly every 47 seconds. */
export function frogFrameAt(time: number, still = false) {
  if (still) return 0;
  const wakePhase = time % 47;
  if (time >= 47 && wakePhase < 8) return 2 + Math.floor(wakePhase) % 4;
  return Math.floor(time / .5) % 8 < 6 ? 0 : 1;
}
