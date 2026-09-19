import { sceneConfig, type Bounds } from "./scene.config";
export function getSceneLayout(width: number, height: number) {
  const scale = Math.min(width / sceneConfig.width, height / sceneConfig.height);
  const x = (width - sceneConfig.width * scale) / 2;
  let y = (height - sceneConfig.height * scale) / 2;
  const compact = width < 760;
  const screenWidth = compact ? Math.max(200, width - 48) : sceneConfig.screen.width * scale;
  // YouTube requires a viewport of at least 200 × 200; never crop the iframe.
  const screenHeight = Math.max(200, screenWidth * 9 / 16);
  const screen: Bounds = {
    x: compact ? (width - screenWidth) / 2 : x + sceneConfig.screen.x * scale,
    y: Math.min(compact ? height * 0.43 : y + sceneConfig.screen.y * scale, height - screenHeight - 100),
    width: screenWidth, height: screenHeight,
  };
  if (compact) y = Math.max(0, screen.y - 36 - 930 * scale);
  return { scale, x, y, screen };
}
