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
        const target = path.resolve(__dirname, "dist", "dev-assets");
        if (fs.existsSync(target)) {
          fs.unlinkSync(target);
        }
        const dir = path.resolve(__dirname, "dist", "dev-assets");
        if (fs.existsSync(dir) && fs.readdirSync(dir).length === 0) {
          fs.rmdirSync(dir);
        }
      } catch (e) {
        // non-fatal
      }
    },
  };
}

// Serve files from web/dev-assets only in dev server (not included in build)
function devAssetsPlugin() {
  return {
    name: "dev-assets",
    configureServer(server: any) {
      const devDir = path.resolve(__dirname, "dev-assets");
      server.middlewares.use("/dev-assets", (req: any, res: any, next: any) => {
        try {
          const urlPath = decodeURIComponent(req.url || "").replace(/^\//, "");
          const filePath = path.join(devDir, urlPath);
          if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
            if (filePath.endsWith(".mp4"))
              res.setHeader("Content-Type", "video/mp4");
            const stream = fs.createReadStream(filePath);
            stream.on("error", next);
            stream.pipe(res);
            return;
          }
        } catch (e) {
          // fallthrough
        }
        next();
      });
    },
  };
}

export default defineConfig({
  plugins: [
    react(),
    cloudflare(),
    tailwindcss(),
    svgr(),
    devAssetsPlugin(),
    removeDevAssetsPlugin(),
  ],
});
