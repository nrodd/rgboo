/** Original pixel-art exports, bundled by Vite without changing their palettes. */
const assets = import.meta.glob<string>("../assets/*.png", { eager: true, query: "?url", import: "default" });
export const artUrl = (name: string) => assets[`../assets/${name}.png`];
export const artFrames = (name: string, count = 8) => Array.from({ length: count }, (_, i) => artUrl(`${name}_${i}`));
