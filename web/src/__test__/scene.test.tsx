import { StrictMode } from "react";
import { expect, test } from "vitest";
import { page } from "vitest/browser";
import { render } from "vitest-browser-react";
import { StreamEmbed } from "../components/StreamEmbed";
import previewUrl from "../../dev-assets/dev-embed.mp4?url";

test("plays direct video inside one canvas under StrictMode and releases it on unmount", async () => {
  const view = await render(
    <StrictMode>
      <StreamEmbed source={{ url: previewUrl, type: "file", loop: true }} />
    </StrictMode>,
  );
  await expect.element(page.getByRole("button", { name: "Pause", exact: true })).toBeEnabled();
  await expect.poll(() => document.querySelectorAll(".scene-canvas-host canvas").length).toBe(1);
  const effects = page.getByRole("button", { name: "CRT effects" });
  await expect.element(effects).toBeEnabled();
  await effects.click();
  await expect.element(effects).toHaveAttribute("aria-pressed", "false");
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await expect.element(page.getByText("Paused", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await expect.element(page.getByRole("button", { name: "Pause", exact: true })).toBeVisible();
  await view.unmount();
  expect(document.querySelectorAll(".scene-canvas-host canvas")).toHaveLength(0);
});

test("shows an offline scene without a source and keeps playback disabled", async () => {
  await render(<StreamEmbed source={{ url: "", type: "auto", loop: false }} />);
  await expect.element(page.getByText("Stream offline")).toBeVisible();
  await expect.element(page.getByRole("button", { name: "Play", exact: true })).toBeDisabled();
  await expect.poll(() => document.querySelectorAll(".scene-canvas-host canvas").length).toBe(1);
});
