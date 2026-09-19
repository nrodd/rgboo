import { defineConfig } from "vitest/config";
import { playwright } from "@vitest/browser-playwright";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import svgr from "vite-plugin-svgr";

export default defineConfig({
  plugins: [react(), tailwindcss(), svgr()],
  optimizeDeps: { include: ["react-dom/client"] },
  test: {
    // Scene tests use real WebGL contexts and shared browser resources.
    fileParallelism: false,
    setupFiles: ["./src/__test__/setup/setupTests.ts"],
    env: {
      VITE_YOUTUBE_VIDEO_ID: "",
    },
    browser: {
      provider: playwright(),
      enabled: true,
      headless: true,
      instances: [{ browser: "chromium" }],
    },
  },
});
