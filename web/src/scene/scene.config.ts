export const layerNames = ["background", "props", "screen", "foreground", "lighting"] as const;
export type SceneLayer = (typeof layerNames)[number];

export interface SceneArtwork {
  id: string;
  src: string;
  layer: SceneLayer;
  x: number;
  y: number;
  width: number;
  height: number;
  /** Radians; artwork rotates around its top-left corner. */
  rotation?: number;
  alpha?: number;
}

/** All positions are in design pixels, independent of browser size. */
export const sceneConfig = {
  width: 1600,
  height: 900,
  background: 0x14121a,
  screen: { x: 320, y: 180, width: 960, height: 540, radius: 24 },
  showPlaceholders: true,
  crt: {
    curvature: 1,
    lineWidth: 1,
    lineContrast: 0.12,
    noise: 0.025,
    noiseSize: 1,
    vignetting: 0.2,
    vignettingAlpha: 0.3,
    vignettingBlur: 0.3,
  },
};

/** Add exported art here. Entries within a layer are drawn in array order. */
export const sceneArtwork: SceneArtwork[] = [];
