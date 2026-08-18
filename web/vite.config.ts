import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import svgr from "vite-plugin-svgr";
import path from "path";
import fs from "fs";

// Remove dev-only assets copied into `dist` (like dev-embed.mp4)
function removeDevAssetsPlugin() {
  return {
    name: "remove-dev-assets",
    closeBundle() {
      try {
        const target = path.resolve(__dirname, "dist", "dev-embed.mp4");
        if (fs.existsSync(target)) {
          fs.unlinkSync(target);
        }
      } catch (e) {
        // non-fatal
      }
    },
  };
}

export default defineConfig({
  plugins: [
    react(),
    cloudflare(),
    tailwindcss(),
    svgr(),
    removeDevAssetsPlugin(),
  ],
});
