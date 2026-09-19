export const layerNames = ["background", "outside", "window", "props", "foreground"] as const;
export type SceneLayer = (typeof layerNames)[number];
export type SceneAction = "toggle-playback" | "toggle-sound" | "toggle-candles" | "frog-hop";
export interface Bounds { x: number; y: number; width: number; height: number }
export interface SceneArtwork extends Bounds {
  id: string;
  /** Add a /scene/file.png path to replace this slot's placeholder. */
  src?: string;
  layer: SceneLayer;
  action?: SceneAction;
  motion?: "fog" | "float";
}
export const sceneConfig = {
  width: 1600, height: 1000, background: 0x171923,
  screen: { x: 215, y: 365, width: 900, height: 506.25 },
};

/** Back-to-front order within each layer. All art uses these design-pixel bounds. */
export const sceneArtwork: SceneArtwork[] = [
  { id: "wall", layer: "background", x: 0, y: 0, width: 1600, height: 1000 },
  { id: "night-sky", layer: "outside", x: 950, y: 125, width: 460, height: 490 },
  { id: "moon", layer: "outside", x: 1180, y: 165, width: 130, height: 130 },
  { id: "fog-back", layer: "outside", x: 960, y: 315, width: 460, height: 130, motion: "fog" },
  { id: "fog-front", layer: "outside", x: 925, y: 465, width: 510, height: 110, motion: "fog" },
  { id: "window-frame", layer: "window", x: 930, y: 105, width: 500, height: 535 },
  { id: "window-sill", layer: "window", x: 910, y: 635, width: 540, height: 28 },
  { id: "frog", layer: "props", x: 1280, y: 565, width: 95, height: 70, action: "frog-hop" },
  { id: "spider", layer: "foreground", x: 105, y: 0, width: 80, height: 240 },
  { id: "candle-left", layer: "foreground", x: 1245, y: 780, width: 55, height: 130, motion: "float", action: "toggle-candles" },
  { id: "candle-right", layer: "foreground", x: 1350, y: 710, width: 65, height: 170, motion: "float", action: "toggle-candles" },
];

/** TV is laid out separately so its YouTube opening stays usable on narrow screens. */
export const tvArtwork = { src: "", width: 964, height: 610.25,
  opening: { x: 32, y: 32, width: 900, height: 506.25 } };
