import { expect, test } from "vitest";
import { page, userEvent } from "vitest/browser";
import { render } from "vitest-browser-react";
import { StreamEmbed } from "../components/StreamEmbed";

// Opt in explicitly: this contacts YouTube and depends on the current broadcast.
test.skipIf(!import.meta.env.VITE_TEST_LIVE_YOUTUBE)("plays the current broadcast through the official embed", async () => {
  await render(<StreamEmbed videoId={import.meta.env.VITE_TEST_LIVE_YOUTUBE} />);
  await expect.element(page.getByTestId("stream-embed-container"), { timeout: 30000 }).toHaveAttribute("data-playback", "playing");
  await expect.element(page.getByRole("group", { name: /Interactive scene/ })).toHaveAttribute("data-tv-powered", "true");
  const originalIframe = document.querySelector(".scene-youtube-screen iframe");
  const scene = document.querySelector<HTMLElement>(".scene-player")!;
  for (const [width, height] of [[390, 844], [1000, 720]]) {
    Object.assign(scene.style, { width: `${width}px`, height: `${height}px`, inset: "auto" });
    await expect.poll(() => document.querySelector("canvas")?.width).toBe(width);
    expect(document.querySelector(".scene-youtube-screen iframe")).toBe(originalIframe);
    await expect.element(page.getByTestId("stream-embed-container")).toHaveAttribute("data-playback", "playing");
  }
  await page.getByRole("button", { name: "VHS tape 3: Settings" }).click();
  await page.getByRole("button", { name: "Pause stream" }).click();
  const volume = page.getByRole("slider", { name: "Stream volume", exact: true });
  await volume.click();
  await userEvent.keyboard("{ArrowLeft}");
  await expect.element(volume).toHaveAttribute("aria-valuenow", "69");
  await expect.element(page.getByRole("button", { name: "Mute stream", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "Mute stream", exact: true }).click();
  await expect.element(page.getByRole("button", { name: "Unmute stream", exact: true })).toBeEnabled();
  await userEvent.keyboard("{Escape}");
  await page.getByRole("group", { name: /Interactive scene/ }).click({ position: { x: 10, y: 10 } });
  await userEvent.keyboard(" ");
  await expect.element(page.getByTestId("stream-embed-container")).toHaveAttribute("data-playback", "playing");
  await userEvent.keyboard(" ");
  await expect.element(page.getByTestId("stream-embed-container")).toHaveAttribute("data-playback", "paused");
  await expect.element(page.getByRole("group", { name: /Interactive scene/ })).toHaveAttribute("data-tv-powered", "false");
}, 45000);
