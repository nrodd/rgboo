import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import fs from "fs";
import path from "path";
import { defineConfig } from "vite";
import svgr from "vite-plugin-svgr";

const localApiTarget = process.env.RGBOO_API_URL || "http://127.0.0.1:8080";
const localApiKey = process.env.RGBOO_API_KEY || "local-api-secret";

const localApiProxy = {
  target: localApiTarget,
  changeOrigin: true,
  headers: { "X-Api-Key": localApiKey },
};

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

export default defineConfig(({ command }) => ({
  plugins: [
    react(),
    // The Worker owns production routing. Locally, Vite serves the SPA and
    // the proxy below recreates the Worker-to-API boundary, including auth.
    ...(command === "build" ? [cloudflare()] : []),
    tailwindcss(),
    svgr(),
    devAssetsPlugin(),
    removeDevAssetsPlugin(),
  ],
  server: {
    host: "127.0.0.1",
    port: 5173,
    strictPort: true,
    proxy: {
      "/api": localApiProxy,
      "/admin-api": {
        ...localApiProxy,
        rewrite: (path: string) => path === "/admin-api/health"
          ? "/"
          : path.replace(/^\/admin-api/, "/admin"),
      },
    },
    watch: {
      usePolling: true,
    },
  },
}));
