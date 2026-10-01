import { frogFrameAt } from "../scene/frogAnimation";
import { StrictMode } from "react";
import { afterEach, expect, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import { render } from "vitest-browser-react";
import { http, HttpResponse } from "msw";
import { test } from "./setup/test-extend";
import { worker } from "./mocks/browser";
import { StreamEmbed } from "../components/StreamEmbed";
import { createLoungingCat } from "../scene/characters";
import { getSceneLayout } from "../scene/layout";
import { sceneArtwork } from "../scene/scene.config";
import { createYouTubePlayer, youtubeWatchUrl, type YouTubeAPI } from "../media/youtubePlayer";

afterEach(() => { localStorage.removeItem("rgboo_cooldown_end"); localStorage.removeItem("rgboo_scene_preferences"); delete window.YT; vi.useRealTimers(); vi.restoreAllMocks(); });
const canvas = () => page.getByRole("group", { name: /Interactive scene/ });

test("frog pointer interaction hops and sends the original color API payload once during cooldown", async () => {
  const requests: unknown[] = [];
  worker.use(http.post("*/api/color", async ({ request }) => {
    requests.push(await request.json());
    return HttpResponse.json({ queue_position: 2, estimated_wait_seconds: 30 });
  }));
  const view = await render(<StrictMode><StreamEmbed videoId="test-video-id" /></StrictMode>);
  await expect.poll(() => document.querySelectorAll("canvas").length).toBe(1);
  await page.getByRole("button", { name: "VHS tape 1: Send a color", exact: true }).click();
  await page.getByRole("textbox", { name: "Hex color" }).fill("#ffffff");
  await userEvent.keyboard("{Escape}");
  const host = document.querySelector(".scene-canvas-host")!;
  const l = getSceneLayout(host.clientWidth, host.clientHeight);
  const frog = sceneArtwork.find((art) => art.id === "frog")!;
  await canvas().click({ position: { x: l.x + (frog.x + frog.width / 2) * l.scale, y: l.y + (frog.y + frog.height / 2) * l.scale } });
  await expect.element(page.getByRole("status", { name: "Frog color submission" })).toHaveTextContent("Frog sent green! #2 in the queue.");
  expect(requests).toEqual([{ username: "Frog", color: { r: 0, g: 255, b: 0 } }]);
  await userEvent.keyboard("f");
  expect(document.body.textContent).not.toContain("Frog is resting");
  expect(requests).toHaveLength(1);
  await userEvent.keyboard("l");
  await expect.element(canvas()).toHaveAttribute("data-candles", "dim");
  await view.unmount();
  expect(document.querySelectorAll("canvas")).toHaveLength(0);
});

test("frog handles a failed API call without pretending the color was queued", async () => {
  worker.use(http.post("*/api/color", () => new HttpResponse(null, { status: 503 })));
  await render(<StreamEmbed videoId="test-video-id" />);
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
    expect(screen.y + screen.height + 220).toBeLessThanOrEqual(Math.max(width < 760 ? 640 : 540, height));
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
  const handle = createYouTubePlayer(host, "test-video-id", changes);
  // Detached iframe verifies the integration contract without contacting YouTube in tests.
  await Promise.resolve();
  const url = new URL(host.querySelector("iframe")!.src);
  expect(url.origin).toBe("https://www.youtube-nocookie.com");
  expect(url.searchParams.get("controls")).toBe("0");
  expect(url.searchParams.get("mute")).toBe("0");
  expect(url.searchParams.get("origin")).toBe(window.location.origin);
  options!.events.onReady({ target: apiPlayer, data: 0 });
  expect(apiPlayer.playVideo).toHaveBeenCalledOnce();
  expect(muted).toBe(false);
  expect(changes).toHaveBeenLastCalledWith(expect.objectContaining({ muted: false, volume: 70 }));
  handle.togglePlayback();
  expect(apiPlayer.pauseVideo).toHaveBeenCalledOnce();
  handle.toggleSound();
  expect(muted).toBe(true);
  handle.setVolume(35);
  expect(volume).toBe(35);
  expect(muted).toBe(false);
  options!.events.onAutoplayBlocked({ target: apiPlayer, data: 0 });
  expect(changes).toHaveBeenLastCalledWith(expect.objectContaining({ status: "blocked" }));
  handle.destroy();
  expect(apiPlayer.destroy).toHaveBeenCalledOnce();
  expect(host.children).toHaveLength(0);
});


test("Submit opens missing fields and submits the saved color draft through the API", async () => {
  const requests: unknown[] = [];
  worker.use(http.post("*/api/color", async ({ request }) => {
    requests.push(await request.json());
    return HttpResponse.json({ queue_position: 4 });
  }));
  await render(<StreamEmbed videoId="test-video-id" />);
  const submit = page.getByRole("button", { name: "VHS tape 4: Submit", exact: true });
  await submit.hover();
  await expect.element(canvas()).toHaveAttribute("data-hovered-tape", "vhs-4");
  await submit.click();
  await expect.element(page.getByRole("textbox", { name: "Name", exact: true })).toHaveFocus();
  expect(requests).toHaveLength(0);
  await page.getByRole("textbox", { name: "Name", exact: true }).fill("Test Viewer");
  await page.getByRole("textbox", { name: "Hex color" }).fill("#123456");
  await userEvent.keyboard("{Escape}");
  await expect.element(submit).toHaveFocus();
  await submit.click();
  await expect.poll(() => requests).toEqual([{ username: "Test Viewer", color: { r: 18, g: 52, b: 86 } }]);
  await expect.element(page.getByRole("button", { name: /Wait \d+s/ })).toBeDisabled();
  await userEvent.keyboard("{Escape}");
  await submit.click();
  expect(requests).toHaveLength(1);
}, 30000);


test("idle animal behavior never submits a color", async () => {
  const submitted = vi.fn();
  worker.use(http.post("*/api/color", () => { submitted(); return HttpResponse.json({ queue_position: 1 }); }));
  await render(<StreamEmbed videoId="test-video-id" />);
  await expect.element(canvas()).toHaveAttribute("data-cat", "lounging");
  await expect.element(canvas()).toHaveAttribute("data-motion", "full");
  await expect.element(canvas(), { timeout: 6000 }).toHaveAttribute("data-frog-frame", "1");
  await expect.element(canvas()).toHaveAttribute("data-frog", "resting");
  expect(submitted).not.toHaveBeenCalled();
  await expect.element(page.getByRole("status", { name: "Frog color submission" })).toHaveTextContent("");
});

test("reduced motion keeps rain and animal behavior still", async () => {
  const originalMatchMedia = window.matchMedia.bind(window);
  vi.spyOn(window, "matchMedia").mockImplementation((query) => {
    const result = originalMatchMedia(query);
    if (query === "(prefers-reduced-motion: reduce)") Object.defineProperty(result, "matches", { value: true });
    return result;
  });
  await render(<StreamEmbed videoId="test-video-id" />);
  await expect.element(canvas()).toHaveAttribute("data-motion", "reduced");
  await expect.element(canvas()).toHaveAttribute("data-cat", "lounging");
  await expect.element(canvas()).toHaveAttribute("data-frog", "resting");
});


test("the custom cat frames keep its paws planted and its tail hanging during breathing", async () => {
  const cat = createLoungingCat();
  await cat.ready;
  cat.root.position.set(20, 100);
  cat.root.scale.set(4);
  const body = cat.root.getChildByLabel("cat-body")!;
  const tail = cat.root.getChildByLabel("cat-tail")!;
  for (let time = 0; time < 24; time += 0.125) {
    cat.update(time, false);
    const bounds = body.getBounds();
    expect(bounds.y + bounds.height).toBeCloseTo(100, 5);
    expect(tail.getBounds().y).toBeCloseTo(100, 5);
    expect(tail.getBounds().height).toBeGreaterThan(0);
  }
  cat.update(0, true);
  const still = body.getBounds();
  expect(still.y + still.height).toBeCloseTo(100, 5);
  cat.root.destroy({ children: true });
});


test("tapes fill the original book gaps and the rug and cat remain aligned on all layouts", () => {
  for (const [width, height] of [[240, 420], [390, 844], [844, 420], [1280, 720], [1440, 900]]) {
    const { screen, stand, tapes, cat, rug } = getSceneLayout(width, height);
    for (const [index, tape] of tapes.entries()) {
      if (index < 3) expect(tape.height).toBeGreaterThan(tape.width);
      else expect(tape.width).toBeGreaterThan(tape.height);
      expect(tape.y + tape.height).toBeCloseTo(tapes[0].y + tapes[0].height);
      expect(tape.y).toBeGreaterThan(stand.y);
      expect(tape.y + tape.height).toBeLessThan(stand.y + stand.height);
      expect(tape.x).toBeGreaterThan(stand.x);
      expect(tape.x + tape.width).toBeLessThan(stand.x + stand.width);
    }
    expect(cat.x).toBeGreaterThan(screen.x + screen.width / 2);
    expect(cat.y).toBeCloseTo(screen.y - 7 * screen.height / 130);
    expect(cat.y - 31 * 34 / 53 * cat.pixelSize * 1.016).toBeGreaterThanOrEqual(0);
    expect(cat.x + 34 * cat.pixelSize).toBeLessThanOrEqual(width);
    expect(rug.x).toBeGreaterThanOrEqual(0);
    expect(rug.x + rug.width).toBeLessThanOrEqual(width);
    expect(rug.y + rug.height + 3).toBeLessThanOrEqual(Math.max(width < 760 ? 640 : 540, height));
  }
});


test("frog sleeps for six ticks then two, waking briefly every 47 seconds", () => {
  expect(Array.from({ length: 8 }, (_, tick) => frogFrameAt(tick * .5))).toEqual([0, 0, 0, 0, 0, 0, 1, 1]);
  expect(frogFrameAt(4)).toBe(0);
  expect(frogFrameAt(46.9)).toBeLessThan(2);
  expect(Array.from({ length: 8 }, (_, second) => frogFrameAt(47 + second))).toEqual([2, 3, 4, 5, 2, 3, 4, 5]);
  expect(frogFrameAt(55)).toBeLessThan(2);
  expect(frogFrameAt(94)).toBe(2);
  expect(frogFrameAt(48, true)).toBe(0);
});


test("the default channel embed follows new broadcasts and its watch link targets the channel", async () => {
  const host = document.createElement("div");
  const source = "channel:UC2GJYmn0WCqW8k1NFp1W7KQ";
  const player = createYouTubePlayer(host, source, () => {});
  await Promise.resolve();
  const url = new URL(host.querySelector("iframe")!.src);
  expect(url.pathname).toBe("/embed/live_stream");
  expect(url.searchParams.get("channel")).toBe("UC2GJYmn0WCqW8k1NFp1W7KQ");
  expect(url.searchParams.get("enablejsapi")).toBe("1");
  expect(youtubeWatchUrl(source)).toBe("https://www.youtube.com/channel/UC2GJYmn0WCqW8k1NFp1W7KQ/live");
  player.destroy();
});


test("YouTube retries one transient player failure, ignores stale callbacks and cleans up timers", async () => {
  vi.useFakeTimers();
  const instances: { events: ConstructorParameters<YouTubeAPI["Player"]>[1]["events"]; player: InstanceType<YouTubeAPI["Player"]> }[] = [];
  window.YT = { Player: class {
    constructor(_element: HTMLIFrameElement, { events }: ConstructorParameters<YouTubeAPI["Player"]>[1]) {
      const player = {
        playVideo: vi.fn(), pauseVideo: vi.fn(), mute: vi.fn(), unMute: vi.fn(),
        setVolume: vi.fn(), getVolume: () => 70, isMuted: () => true, getPlayerState: () => 1, destroy: vi.fn(),
      };
      instances.push({ events, player });
      return player;
    }
  } as YouTubeAPI["Player"] };
  const host = document.createElement("div");
  const changes = vi.fn();
  const handle = createYouTubePlayer(host, "test-video-id", changes);
  await Promise.resolve();
  const firstFrame = host.querySelector("iframe");
  instances[0].events.onReady({ target: instances[0].player, data: 0 });
  instances[0].events.onError({ target: instances[0].player, data: 5 });
  expect(changes).toHaveBeenLastCalledWith(expect.objectContaining({ status: "error", ready: false, errorCode: 5 }));
  await vi.advanceTimersByTimeAsync(1500);
  expect(instances).toHaveLength(2);
  expect(instances[0].player.destroy).toHaveBeenCalledOnce();
  expect(host.querySelector("iframe")).not.toBe(firstFrame);
  const callCount = changes.mock.calls.length;
  instances[0].events.onStateChange({ target: instances[0].player, data: 1 });
  expect(changes).toHaveBeenCalledTimes(callCount);
  instances[1].events.onError({ target: instances[1].player, data: 5 });
  await vi.advanceTimersByTimeAsync(1500);
  expect(instances).toHaveLength(2);
  handle.retry();
  await Promise.resolve();
  expect(instances).toHaveLength(3);
  instances[2].events.onError({ target: instances[2].player, data: 153 });
  await vi.advanceTimersByTimeAsync(1500);
  expect(instances).toHaveLength(3);
  handle.destroy();
  await vi.advanceTimersByTimeAsync(20000);
  expect(host.children).toHaveLength(0);
  expect(vi.getTimerCount()).toBe(0);
});


test("a disposed startup never navigates an iframe; an unready controller is replaced rather than orphaned", async () => {
  vi.useFakeTimers();
  const instances: { frame: HTMLIFrameElement; events: ConstructorParameters<YouTubeAPI["Player"]>[1]["events"]; destroy: ReturnType<typeof vi.fn> }[] = [];
  window.YT = { Player: class {
    constructor(frame: HTMLIFrameElement, { events }: ConstructorParameters<YouTubeAPI["Player"]>[1]) {
      const destroy = vi.fn();
      instances.push({ frame, events, destroy });
      return { destroy } as unknown as InstanceType<YouTubeAPI["Player"]>;
    }
  } as YouTubeAPI["Player"] };
  const host = document.createElement("div");
  const abandoned = createYouTubePlayer(host, "test-video-id", () => {});
  abandoned.destroy();
  await Promise.resolve();
  expect(host.children).toHaveLength(0);
  expect(instances).toHaveLength(0);
  const changes = vi.fn();
  const handle = createYouTubePlayer(host, "test-video-id", changes);
  await Promise.resolve();
  const firstSource = instances[0].frame.src;
  await vi.advanceTimersByTimeAsync(15000);
  expect(instances).toHaveLength(2);
  expect(instances[0].destroy).toHaveBeenCalledOnce();
  expect(instances[0].frame.src).toBe(firstSource);
  expect(host.querySelector("iframe")).toBe(instances[1].frame);
  await vi.advanceTimersByTimeAsync(15000);
  expect(instances[1].destroy).toHaveBeenCalledOnce();
  const native = host.querySelector("iframe")!;
  expect(native).not.toBe(instances[1].frame);
  expect(new URL(native.src).searchParams.get("enablejsapi")).toBe("0");
  const count = changes.mock.calls.length;
  instances[1].events.onStateChange({ target: {} as InstanceType<YouTubeAPI["Player"]>, data: 1 });
  expect(changes).toHaveBeenCalledTimes(count);
  window.dispatchEvent(new Event("online"));
  await Promise.resolve();
  expect(instances).toHaveLength(3);
  expect(host.querySelector("iframe")).toBe(instances[2].frame);
  handle.destroy();
  window.dispatchEvent(new Event("online"));
  await Promise.resolve();
  expect(instances).toHaveLength(3);
  expect(vi.getTimerCount()).toBe(0);
});
