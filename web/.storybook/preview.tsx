import type { Preview } from "@storybook/react-vite";

import "../src/theme.css";

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },

    a11y: {
      // 'todo' - show a11y violations in the test UI only
      // 'error' - fail CI on a11y violations
      // 'off' - skip a11y checks entirely
      test: "todo",
    },

    backgrounds: {
      options: {
        gradient: {
          name: "Gradient",
          value: "linear-gradient(160deg, #6441a4, #7d3909)",
        },
        dark: { name: "Dark", value: "#333" },
        light: { name: "Light", value: "#ebdbbe" },
        orange: { name: "Pumpkin", value: "#e36810" },
      },
    },
  },
};

export default preview;
