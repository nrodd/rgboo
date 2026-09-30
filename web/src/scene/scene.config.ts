import { artFrames, artUrl } from "./artAssets";
import roomBackgroundUrl from "../assets/background.webp";
import candleFatUrl from "../assets/candle_fat.webp";
import candleTallUrl from "../assets/candle_tall.webp";
import ghostUrl from "../assets/ghost.webp";
import moonUrl from "../assets/moon.webp";
import spiderTwoUrl from "../assets/spider_2.webp";
import spiderThreeUrl from "../assets/spider_3.webp";
import spiderFourUrl from "../assets/spider_4.webp";
import spiderDefaultUrl from "../assets/spider_default.webp";
import windowUrl from "../assets/window.webp";

export const layerNames = ["background", "outside", "window", "props", "foreground"] as const;
export type SceneLayer = (typeof layerNames)[number];
export type SceneAction = "toggle-playback" | "toggle-sound" | "toggle-candles" | "frog-hop" | "open-submit" | "open-color" | "open-links" | "open-settings";
export interface Bounds { x: number; y: number; width: number; height: number }
export interface SceneArtwork extends Bounds {
  id: string;
  /** Add a /scene/file.webp path to replace this slot's placeholder. */
  src?: string;
  /** Optional sequence of frame assets for animated art. */
  frames?: string[];
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
export const windowArtwork = { src: windowUrl, x: 990, y: 45, width: 540, height: 540 };
const windowPixel = windowArtwork.width / 97;
export const windowOpening = { x: windowArtwork.x + 8 * windowPixel, y: windowArtwork.y + 6 * windowPixel,
  width: 80 * windowPixel, height: 77 * windowPixel };

/** Back-to-front order within each layer. All art uses these design-pixel bounds. */
export const sceneArtwork: SceneArtwork[] = [
  { id: "wall", layer: "background", x: 0, y: 0, width: 1600, height: 1000, src: roomBackgroundUrl },
  { id: "night-sky", layer: "outside", x: 1030, y: 65, width: 460, height: 490 },
  { id: "moon", layer: "outside", x: 1260, y: 105, width: 130, height: 130, src: moonUrl },
  { id: "fog-back", layer: "outside", x: 990, y: 45, width: 540, height: 540, frames: artFrames("fog"), motion: "fog" },
  { id: "fog-front", layer: "outside", x: 1010, y: 175, width: 540, height: 540, frames: artFrames("fog"), motion: "fog" },
  { id: "frog", layer: "outside", x: 1360, y: 430, width: 95, height: 70, action: "frog-hop", frames: [...artFrames("frog_asleep", 2), ...artFrames("frog_awake", 4)], crop: { x: 9, y: 20, width: 17, height: 12 } },
  { id: "rain", layer: "outside", ...windowArtwork, frames: artFrames("rain") },
  { id: "window-frame", layer: "window", ...windowArtwork },
  { id: "tea-mug", layer: "props", x: 1250, y: 456, width: 58, height: 56 },
  { id: "pumpkin", layer: "foreground", x: 110, y: 810, width: 96, height: 96 },
  { id: "spider", layer: "foreground", x: -20, y: 0, width: 240, height: 240, frames: [spiderDefaultUrl, spiderTwoUrl, spiderThreeUrl, spiderFourUrl] },
  { id: "ghost", layer: "foreground", x: -100, y: 470, width: 240, height: 240, src: ghostUrl },
  { id: "candle-left", src: candleFatUrl, crop: { x: 8, y: 7, width: 17, height: 25 }, layer: "foreground", x: 1190, y: 742, width: 68, height: 132, motion: "float", action: "toggle-candles" },
  { id: "candle-right", src: candleTallUrl, crop: { x: 9, y: 2, width: 15, height: 30 }, layer: "foreground", x: 1272, y: 705, width: 68, height: 168, motion: "float", action: "toggle-candles" },
];

/** TV is laid out separately so its YouTube opening stays usable on narrow screens. */
export const tvArtwork = { src: artUrl("tv"), width: 255, height: 209,
  opening: { x: 13, y: 9, width: 229, height: 130 } };

/** Native shelf gaps between the books baked into tv.webp. */
export const tapeArtworkSlots: Bounds[] = [
  { x: 62, y: 166, width: 14, height: 29 }, // Color: former Info gap.
  { x: 174, y: 166, width: 14, height: 29 }, // Info: shares the wide gap with Submit.
  { x: 111, y: 166, width: 14, height: 29 }, // Setup: former Info gap.
  { x: 189, y: 185, width: 30, height: 10 },
];

/** Interactive tapes share source-space positions with the original shelf. */
export const vhsTapes = [
  { id: "vhs-1", src: artUrl("vhs_color"), frames: artFrames("vhs_color_hover"), label: "VHS tape 1: Send a color", title: "Send a color", color: 0x9f855f },
  { id: "vhs-2", src: artUrl("vhs_info"), frames: artFrames("vhs_info_hover"), label: "VHS tape 2: Links", title: "Links", color: 0x60867a },
  { id: "vhs-3", src: artUrl("vhs_name"), frames: artFrames("vhs_name_hover"), label: "VHS tape 3: Settings", title: "Settings", color: 0x946172 },
  { id: "vhs-4", src: artUrl("vhs_submit"), frames: artFrames("vhs_submit_hover"), label: "VHS tape 4: Submit", title: "Submit", color: 0x69748f },
];
