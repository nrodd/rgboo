import { sceneConfig, type Bounds } from "./scene.config";
export function getSceneLayout(width: number, height: number) {
  width = Math.max(240, width);
  height = Math.max(width < 760 ? 640 : 540, height);
  let scale = Math.min(width / sceneConfig.width, height / sceneConfig.height);
  let x = (width - sceneConfig.width * scale) / 2;
  let y = (height - sceneConfig.height * scale) / 2;
  const compact = width < 760;
  const screenWidth = Math.max(200, Math.min(
    compact ? width - 48 : sceneConfig.screen.width * scale,
    (height - (compact ? 500 : 340)) * 16 / 9,
  ));
  // Preserve the official player's minimum viewport and reserve room for the stand.
  const screenHeight = Math.max(200, screenWidth * 9 / 16);
  const screen: Bounds = {
    x: compact ? (width - screenWidth) / 2 : x + sceneConfig.screen.x * scale,
    y: Math.max(104, Math.min(compact ? height * 0.35 : y + sceneConfig.screen.y * scale, height - screenHeight - 268)),
    width: screenWidth, height: screenHeight,
  };
  if (compact) {
    // Fit the whole windowsill above the television, including squat tablets.
    scale = Math.min(scale, Math.max(0.08, (screen.y - 50) / 663));
    x = width - 24 - 1463 * scale;
    y = Math.max(0, screen.y - 50 - 663 * scale);
  }
  const stand = { x: screen.x - 16, y: screen.y + screen.height + 88, width: screen.width + 32, height: 96 };
  const gap = 10;
  const tapeWidth = Math.min(34, (screen.width - 24 - gap * 4) / 5);
  const tapes = Array.from({ length: 5 }, (_, index) => ({
    x: screen.x + 12 + index * (tapeWidth + gap), y: stand.y + 80 - [60, 64, 62, 60, 64][index],
    width: tapeWidth, height: [60, 64, 62, 60, 64][index],
  }));
  const catPixel = Math.max(2, Math.min(5, Math.floor(screen.width / 100)));
  // Body rests on the right edge; only the tail can extend in front of the window.
  const cat = {
    x: Math.min(width - 34 * catPixel - 8, screen.x + screen.width - 28 * catPixel),
    y: screen.y - 22, pixelSize: catPixel,
  };
  const rugX = Math.max(8, stand.x - 72);
  const rug = { x: rugX, y: stand.y + stand.height - 24,
    width: Math.min(width - rugX - 8, stand.width + 144), height: 72 };
  return { scale, x, y, screen, stand, tapes, cat, rug };
}
