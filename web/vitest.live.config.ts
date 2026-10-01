import { defineConfig } from "vitest/config";
import config from "./vitest.config";

// Live playback is deliberately excluded from the normal suite and push hook.
export default defineConfig({
  ...config,
  plugins: config.plugins?.filter((plugin) => plugin && "name" in plugin && plugin.name !== "offline-youtube-tests"),
  test: {
    ...config.test,
    include: ["src/__test__/youtube-live.test.tsx"],
    exclude: ["**/node_modules/**"],
    setupFiles: ["./src/theme.css"],
  },
});
