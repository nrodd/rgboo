import roomBackgroundUrl from "../assets/background.png";
import candleFatUrl from "../assets/candle_fat.png";
import candleTallUrl from "../assets/candle_tall.png";
import windowUrl from "../assets/window.png";

export const layerNames = ["background", "outside", "window", "props", "foreground"] as const;
export type SceneLayer = (typeof layerNames)[number];
export type SceneAction = "toggle-playback" | "toggle-sound" | "toggle-candles" | "frog-hop" | "coming-soon" | "open-color" | "open-links" | "open-settings";
export interface Bounds { x: number; y: number; width: number; height: number }
export interface SceneArtwork extends Bounds {
  id: string;
  /** Add a /scene/file.png path to replace this slot's placeholder. */
  src?: string;
  /** Optional visible bounds inside a padded export. */
  crop?: Bounds;
  layer: SceneLayer;
  action?: SceneAction;
  motion?: "fog" | "float";
}
export const sceneConfig = {
  width: 1600, height: 1000, background: 0x1e1a27,
  ambience: { color: 0x827ca8 },
  screen: { x: 215, y: 255, width: 900, height: 506.25 },
};

/** The 97px export includes its sill; outside scenery only fills its panes. */
export const windowArtwork = { src: windowUrl, x: 910, y: 105, width: 540, height: 540 };
const windowPixel = windowArtwork.width / 97;
export const windowOpening = { x: windowArtwork.x + 8 * windowPixel, y: windowArtwork.y + 6 * windowPixel,
  width: 80 * windowPixel, height: 77 * windowPixel };

/** Back-to-front order within each layer. All art uses these design-pixel bounds. */
export const sceneArtwork: SceneArtwork[] = [
  { id: "wall", layer: "background", x: 0, y: 0, width: 1600, height: 1000, src: roomBackgroundUrl },
  { id: "night-sky", layer: "outside", x: 950, y: 125, width: 460, height: 490 },
  { id: "moon", layer: "outside", x: 1180, y: 165, width: 130, height: 130 },
  { id: "fog-back", layer: "outside", x: 960, y: 315, width: 460, height: 130, motion: "fog" },
  { id: "fog-front", layer: "outside", x: 925, y: 465, width: 510, height: 110, motion: "fog" },
  { id: "window-frame", layer: "window", ...windowArtwork },
  { id: "tea-mug", layer: "props", x: 1170, y: 516, width: 58, height: 56 },
  { id: "pumpkin", layer: "foreground", x: 110, y: 810, width: 96, height: 96 },
  { id: "frog", layer: "props", x: 1280, y: 510, width: 95, height: 70, action: "frog-hop" },
  { id: "spider", layer: "foreground", x: 105, y: 0, width: 80, height: 240 },
  { id: "candle-left", src: candleFatUrl, crop: { x: 8, y: 7, width: 17, height: 25 }, layer: "foreground", x: 1190, y: 742, width: 68, height: 132, motion: "float", action: "toggle-candles" },
  { id: "candle-right", src: candleTallUrl, crop: { x: 9, y: 2, width: 15, height: 30 }, layer: "foreground", x: 1272, y: 705, width: 68, height: 168, motion: "float", action: "toggle-candles" },
];

/** TV is laid out separately so its YouTube opening stays usable on narrow screens. */
export const tvArtwork = { src: "", width: 964, height: 610.25,
  opening: { x: 32, y: 32, width: 900, height: 506.25 } };

/** Shelf slots; replace individual tapes with exported pixel art when ready. */
export const vhsTapes = [
  { id: "vhs-1", label: "VHS tape 1: Send a color", title: "Send a color", color: 0x9f855f },
  { id: "vhs-2", label: "VHS tape 2: Links", title: "Links", color: 0x60867a },
  { id: "vhs-3", label: "VHS tape 3: Settings", title: "Settings", color: 0x946172 },
  { id: "vhs-4", label: "VHS tape 4: Coming soon", title: "Coming soon", color: 0x69748f },
  { id: "vhs-5", label: "VHS tape 5: Coming soon", title: "Coming soon", color: 0x9b8757 },
];
