import { defineConfig } from "vitest/config";
import { playwright } from "@vitest/browser-playwright";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import svgr from "vite-plugin-svgr";

// More info at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon
export default defineConfig({
  plugins: [react(), tailwindcss(), svgr()],
  test: {
    projects: [
      {
        extends: true,
        test: {
          setupFiles: ["./src/__test__/setup/setupTests.ts"],
          env: {
            VITE_DEV_EMBED: "true",
          },
          browser: {
            provider: playwright(),
            enabled: true,
            headless: true,
            instances: [
              {
                browser: "chromium",
              },
            ],
          },
        },
      },
    ],
  },
});
