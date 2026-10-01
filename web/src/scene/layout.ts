import { sceneConfig, tapeArtworkSlots, tvArtwork, type Bounds } from "./scene.config";
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
    y: Math.max(104, Math.min(compact ? height * 0.35 : y + sceneConfig.screen.y * scale, height - screenHeight - 268,
      height - screenHeight * (tvArtwork.height - tvArtwork.opening.y) / tvArtwork.opening.height - 54)),
    width: screenWidth, height: screenHeight,
  };
  if (compact) {
    // Fit the whole windowsill above the television, including squat tablets.
    scale = Math.min(scale, Math.max(0.08, (screen.y - 50) / 603));
    x = width - 24 - 1543 * scale;
    y = Math.max(0, screen.y - 50 - 603 * scale);
  }
  // Map the original shelf and its book gaps with exactly the TV sprite's transform.
  const sx = screen.width / tvArtwork.opening.width;
  const sy = screen.height / tvArtwork.opening.height;
  const tvX = screen.x - tvArtwork.opening.x * sx;
  const tvY = screen.y - tvArtwork.opening.y * sy;
  // Align the SVG lettering baseline with the TV upper rim.
  const logoWidth = Math.min(220, screen.width * (compact ? .36 : .27));
  const logoHeight = 205 / 360 * logoWidth;
  const logoY = tvY - 125 / 360 * logoWidth;
  const logo = { x: tvX + (tvArtwork.width * sx - logoWidth) / 2, y: logoY, width: logoWidth,
    height: logoHeight };
  const stand = { x: tvX, y: tvY + 161 * sy, width: tvArtwork.width * sx, height: 47 * sy };
  const tapes = tapeArtworkSlots.map((slot) => ({
    x: tvX + slot.x * sx, y: tvY + slot.y * sy,
    width: slot.width * sx, height: slot.height * sy,
  }));
  // The custom cat has 31 body rows in a 53px-wide crop. Leave room for its
  // ears above the TV even when a short viewport pushes the screen upward.
  const catPixel = Math.max(2, Math.min(compact ? 2 : 5, Math.floor(screen.width / 100), Math.floor((screen.y - 30) / (31 * 34 / 53))));
  // Body rests on the right edge; only the tail can extend in front of the window.
  const cat = {
    x: Math.min(width - 34 * catPixel - 8, screen.x + screen.width - 28 * catPixel),
    y: tvY + 2 * sy, pixelSize: catPixel,
  };
  const rugX = Math.max(8, stand.x - 72);
  const rug = { x: rugX, y: stand.y + stand.height - 24,
    width: Math.min(width - rugX - 8, stand.width + 144), height: 72 };
  return { scale, x, y, screen, stand, tapes, cat, rug, logo };
}
