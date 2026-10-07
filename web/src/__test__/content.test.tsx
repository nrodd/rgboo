import { afterEach, expect } from "vitest";
import { page } from "vitest/browser";
import { test } from "./setup/test-extend";
import { renderApp } from "./setup/test-utils";

afterEach(() => { delete window.YT; delete window.Twitch; });

test("the homepage is a full viewport canvas without the old page UI", async () => {
  await renderApp();
  await expect.element(page.getByTestId("stream-embed-container")).toBeInTheDocument();
  await expect.poll(() => document.querySelectorAll(".scene-canvas-host canvas").length).toBe(1);
  const iframe = document.querySelector<HTMLIFrameElement>(".scene-youtube-screen iframe")!;
  expect(iframe.dataset.source).toBe("na10_dev");
  expect(iframe.src).toBe("about:blank");
  expect(iframe.srcdoc).toContain("RGBOO test stream");
  expect(document.querySelector('script[src="https://player.twitch.tv/js/embed/v1.js"]')).toBeNull();
  await expect.element(page.getByTestId("stream-embed-container")).toHaveAttribute("data-playback", "playing");
  const canvas = document.querySelector("canvas")!.getBoundingClientRect();
  expect(canvas.width).toBe(window.innerWidth);
  expect(canvas.height).toBe(window.innerHeight);
  expect(document.querySelector('[data-testid="info-button"]')).toBeNull();
  expect(document.querySelector('[data-testid="color-form-container"]')).toBeNull();
  expect(document.querySelector('[data-testid="footer"]')).toBeNull();
  expect(document.querySelector(".scene-controls")).toBeNull();
});
