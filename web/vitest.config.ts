import { defineConfig } from "vitest/config";
import { playwright } from "@vitest/browser-playwright";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";
import svgr from "vite-plugin-svgr";

export default defineConfig({
  plugins: [react(), tailwindcss(), svgr(), {
    name: "offline-youtube-tests",
    enforce: "pre",
    resolveId(source, importer) {
      const fixture = path.resolve("src/__test__/setup/test-youtube-adapter.ts");
      if (source.endsWith("/media/youtubePlayer") && importer !== fixture) return fixture;
    },
  }],
  optimizeDeps: { include: ["react-dom/client"] },
  test: {
    exclude: ["**/node_modules/**", "src/__test__/youtube-live.test.tsx"],
    // Scene tests use real WebGL contexts and shared browser resources.
    fileParallelism: false,
    setupFiles: ["./src/__test__/setup/setupTests.ts"],
    env: {
      // A stale video override must never replace the component's channel.
      VITE_YOUTUBE_VIDEO_ID: "obsolete-video-id",
    },
    browser: {
      provider: playwright(),
      enabled: true,
      headless: true,
      instances: [{ browser: "chromium" }],
    },
  },
});
