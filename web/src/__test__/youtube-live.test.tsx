import { expect, test } from "vitest";
import { page } from "vitest/browser";
import { render } from "vitest-browser-react";
import { StreamEmbed } from "../components/StreamEmbed";

// Opt in explicitly: this contacts YouTube and depends on the current broadcast.
test.skipIf(!import.meta.env.VITE_TEST_LIVE_YOUTUBE)("plays the current broadcast through the official embed", async () => {
  await render(<StreamEmbed videoId={import.meta.env.VITE_TEST_LIVE_YOUTUBE} />);
  await expect.element(page.getByTestId("stream-embed-container"), { timeout: 30000 }).toHaveAttribute("data-playback", "playing");
  await page.getByRole("button", { name: "Pause stream" }).click();
  await expect.element(page.getByTestId("stream-embed-container")).toHaveAttribute("data-playback", "paused");
}, 45000);
