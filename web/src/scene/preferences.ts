export interface ScenePreferences { reduceMotion: boolean; highContrast: boolean; showLabels: boolean }
export const defaultPreferences: ScenePreferences = { reduceMotion: false, highContrast: false, showLabels: false };
export function readPreferences(): ScenePreferences {
  try {
    const saved = JSON.parse(localStorage.getItem("rgboo_scene_preferences") ?? "{}");
    return { reduceMotion: saved.reduceMotion === true, highContrast: saved.highContrast === true, showLabels: saved.showLabels === true };
  } catch { return defaultPreferences; }
}
