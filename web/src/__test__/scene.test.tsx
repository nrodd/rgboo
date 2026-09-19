import { StrictMode } from "react";
import { afterEach, expect, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import { render } from "vitest-browser-react";
import { http, HttpResponse } from "msw";
import { test } from "./setup/test-extend";
import { worker } from "./mocks/browser";
import { StreamEmbed } from "../components/StreamEmbed";
import { getSceneLayout } from "../scene/layout";
import { createYouTubePlayer, type YouTubeAPI } from "../media/youtubePlayer";

afterEach(() => { localStorage.removeItem("rgboo_cooldown_end"); delete window.YT; vi.restoreAllMocks(); });
const canvas = () => page.getByRole("group", { name: /Interactive scene/ });

test("frog pointer interaction hops and sends the original color API payload once during cooldown", async () => {
  const requests: unknown[] = [];
  worker.use(http.post("*/api/color", async ({ request }) => {
    requests.push(await request.json());
    return HttpResponse.json({ queue_position: 2, estimated_wait_seconds: 30 });
  }));
  const view = await render(<StrictMode><StreamEmbed videoId="" /></StrictMode>);
  await expect.poll(() => document.querySelectorAll("canvas").length).toBe(1);
  const host = document.querySelector(".scene-canvas-host")!;
  const l = getSceneLayout(host.clientWidth, host.clientHeight);
  await canvas().click({ position: { x: l.x + 1327 * l.scale, y: l.y + 600 * l.scale } });
  await expect.element(page.getByRole("status", { name: "Frog color submission" })).toHaveTextContent("Frog sent green! #2 in the queue.");
  expect(requests).toEqual([{ username: "Frog", color: { r: 143, g: 167, b: 123 } }]);
  await userEvent.keyboard("f");
  await expect.element(page.getByRole("status", { name: "Frog color submission" })).toHaveTextContent(/Frog is resting/);
  expect(requests).toHaveLength(1);
  await userEvent.keyboard("l");
  await expect.element(canvas()).toHaveAttribute("data-candles", "dim");
  await view.unmount();
  expect(document.querySelectorAll("canvas")).toHaveLength(0);
});

test("frog handles a failed API call without pretending the color was queued", async () => {
  worker.use(http.post("*/api/color", () => new HttpResponse(null, { status: 503 })));
  await render(<StreamEmbed videoId="" />);
  await canvas().click({ position: { x: 10, y: 10 } });
  await userEvent.keyboard("f");
  await expect.element(page.getByRole("status", { name: "Frog color submission" })).toHaveTextContent("Frog couldn't send green");
  expect(localStorage.getItem("rgboo_cooldown_end")).toBeNull();
});

test("TV layout preserves the YouTube minimum size and stays inside small and desktop viewports", () => {
  for (const [width, height] of [[240, 420], [320, 568], [390, 844], [844, 420], [1440, 900]]) {
    const { screen } = getSceneLayout(width, height);
    expect(screen.width).toBeGreaterThanOrEqual(200);
    expect(screen.height).toBeGreaterThanOrEqual(200);
    expect(screen.x).toBeGreaterThanOrEqual(0);
    expect(screen.y).toBeGreaterThanOrEqual(0);
    expect(screen.x + screen.width).toBeLessThanOrEqual(width);
    expect(screen.y + screen.height + 96).toBeLessThanOrEqual(height);
  }
});

test("official player API handles playback, sound and teardown without extracting video", async () => {
  let options: ConstructorParameters<YouTubeAPI["Player"]>[1];
  let muted = true, volume = 70, state = 2;
  const apiPlayer = {
    playVideo: vi.fn(() => { state = 1; options.events.onStateChange({ target: apiPlayer, data: 1 }); }),
    pauseVideo: vi.fn(() => { state = 2; options.events.onStateChange({ target: apiPlayer, data: 2 }); }),
    mute: () => { muted = true; }, unMute: () => { muted = false; },
    setVolume: (v: number) => { volume = v; }, getVolume: () => volume, isMuted: () => muted,
    getPlayerState: () => state, destroy: vi.fn(),
  };
  window.YT = { Player: class {
    constructor(_element: HTMLIFrameElement, opts: typeof options) { options = opts; return apiPlayer; }
  } as YouTubeAPI["Player"] };
  const host = document.createElement("div");
  const changes = vi.fn();
  const handle = createYouTubePlayer(host, "6LVM4iQfMX4", changes);
  // Detached iframe verifies the integration contract without contacting YouTube in tests.
  await Promise.resolve();
  const url = new URL(host.querySelector("iframe")!.src);
  expect(url.origin).toBe("https://www.youtube.com");
  expect(url.searchParams.get("controls")).toBe("0");
  expect(url.searchParams.get("origin")).toBe(window.location.origin);
  options!.events.onReady({ target: apiPlayer, data: 0 });
  expect(apiPlayer.playVideo).toHaveBeenCalledOnce();
  handle.togglePlayback();
  expect(apiPlayer.pauseVideo).toHaveBeenCalledOnce();
  handle.toggleSound();
  expect(muted).toBe(false);
  handle.setVolume(35);
  expect(volume).toBe(35);
  options!.events.onAutoplayBlocked({ target: apiPlayer, data: 0 });
  expect(changes).toHaveBeenLastCalledWith(expect.objectContaining({ status: "blocked" }));
  handle.destroy();
  expect(apiPlayer.destroy).toHaveBeenCalledOnce();
  expect(host.children).toHaveLength(0);
});
