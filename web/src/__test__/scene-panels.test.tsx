import { afterEach, expect, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import { render } from "vitest-browser-react";
import { http, HttpResponse } from "msw";
import { test } from "./setup/test-extend";
import { worker } from "./mocks/browser";
import { StreamEmbed } from "../components/StreamEmbed";
import { getSceneLayout } from "../scene/layout";

const tape = (index: number) => page.getByRole("button", { name: new RegExp(`^VHS tape ${index}:`) });
const canvas = () => page.getByRole("group", { name: /Interactive scene/ });
afterEach(() => { localStorage.removeItem("rgboo_cooldown_end"); localStorage.removeItem("rgboo_scene_preferences"); vi.restoreAllMocks(); });

test("first tape submits a name and RGB color, shares frog cooldown, and returns keyboard focus", async () => {
  const requests: unknown[] = [];
  worker.use(http.post("*/api/color", async ({ request }) => { requests.push(await request.json()); return HttpResponse.json({ queue_position: 3 }); }));
  await render(<StreamEmbed videoId="" />);
  await tape(1).click();
  await expect.element(page.getByRole("dialog", { name: "Color" })).toHaveAttribute("data-side", "right");
  await page.getByRole("textbox", { name: "Name", exact: true }).fill("Test Viewer");
  await page.getByRole("textbox", { name: "Hex color" }).fill("#123456");
  await page.getByRole("button", { name: "Send" }).click();
  await expect.element(page.getByRole("status")).toHaveTextContent("Queued · #3");
  expect(requests).toEqual([{ username: "Test Viewer", color: { r: 18, g: 52, b: 86 } }]);
  await expect.element(page.getByRole("button", { name: /Wait \d+s/ })).toBeDisabled();
  await userEvent.keyboard("{Escape}");
  await expect.element(tape(1)).toHaveFocus();
  await canvas().click({ position: { x: 10, y: 10 } });
  await userEvent.keyboard("f");
  expect(requests).toHaveLength(1);
  expect(document.body.textContent).not.toContain("Frog is resting");
});

test("invalid inputs and server rejection keep the color form available to retry", async () => {
  const requests = vi.fn();
  worker.use(http.post("*/api/color", () => { requests(); return HttpResponse.json({ error: "Queue is full" }, { status: 503 }); }));
  await render(<StreamEmbed videoId="" />);
  await tape(1).click();
  await page.getByRole("textbox", { name: "Name", exact: true }).fill("Test!!!");
  await page.getByRole("button", { name: "Send" }).click();
  await expect.element(page.getByRole("status")).toHaveTextContent("alphanumeric");
  expect(requests).not.toHaveBeenCalled();
  await page.getByRole("textbox", { name: "Name", exact: true }).fill("Test Viewer");
  await page.getByRole("button", { name: "Send" }).click();
  await expect.element(page.getByRole("status")).toHaveTextContent("Queue is full");
  await expect.element(page.getByRole("button", { name: "Send" })).toBeEnabled();
  expect(localStorage.getItem("rgboo_cooldown_end")).toBeNull();
});

test("second tape opens old links from the right and the dialog traps focus", async () => {
  await render(<StreamEmbed videoId="" />);
  await tape(2).click();
  await expect.element(page.getByRole("dialog", { name: "Links" })).toHaveAttribute("data-side", "right");
  await expect.element(page.getByRole("dialog", { name: "Links" })).toHaveFocus();
  await expect.element(page.getByRole("button", { name: "Close", exact: true })).not.toHaveFocus();
  await userEvent.keyboard("{Tab}");
  await expect.element(page.getByRole("button", { name: "Close", exact: true })).toHaveFocus();
  expect(document.activeElement?.matches(":focus-visible")).toBe(true);
  await expect.element(page.getByRole("link", { name: /Twitch/ })).toHaveAttribute("href", "https://twitch.tv/na10_dev");
  await expect.element(page.getByRole("link", { name: /GitHub/ })).toHaveAttribute("href", "https://github.com/nrodd/rgboo");
  for (let i = 0; i < 8; i++) {
    await userEvent.keyboard("{Tab}");
    expect(document.activeElement?.closest('[role="dialog"]')).not.toBeNull();
  }
  await userEvent.keyboard("{Escape}");
  await expect.element(tape(2)).toHaveFocus();
});

test("settings change scene behavior without recreating the canvas and persist after remount", async () => {
  const view = await render(<StreamEmbed videoId="" />);
  await expect.element(canvas()).toHaveAttribute("data-motion", "full");
  const originalCanvas = document.querySelector("canvas");
  await tape(3).click();
  await page.getByRole("switch", { name: "Reduce motion", exact: true }).click();
  await page.getByRole("switch", { name: "Higher UI contrast", exact: true }).click();
  await page.getByRole("switch", { name: "Show tape labels", exact: true }).click();
  for (const toggle of Array.from(document.querySelectorAll<HTMLElement>('[role="switch"]'))) {
    const track = toggle.getBoundingClientRect();
    const thumb = toggle.firstElementChild!.getBoundingClientRect();
    expect(thumb.left).toBeGreaterThanOrEqual(track.left);
    expect(thumb.right).toBeLessThanOrEqual(track.right);
  }
  expect(document.querySelector("canvas")).toBe(originalCanvas);
  await expect.poll(() => originalCanvas?.dataset.motion).toBe("reduced");
  expect(JSON.parse(localStorage.getItem("rgboo_scene_preferences")!)).toEqual({ reduceMotion: true, highContrast: true, showLabels: true });
  await userEvent.keyboard("{Escape}");
  await view.unmount();
  await render(<StreamEmbed videoId="" />);
  await expect.element(canvas()).toHaveAttribute("data-motion", "reduced");
  await tape(3).click();
  await expect.element(page.getByRole("switch", { name: "Reduce motion", exact: true })).toBeChecked();
  // Two real WebGL mounts plus modal interactions take longer on CI software rendering.
}, 30000);

test("repeated live resizes retain the canvas, redraw pixels and align every tape with the scene", async () => {
  await render(<StreamEmbed videoId="" />);
  await expect.element(canvas()).toBeInTheDocument();
  const originalCanvas = document.querySelector("canvas")!;
  const root = document.querySelector<HTMLElement>(".scene-player")!;
  for (const [width, height] of [[390, 844], [844, 540], [320, 640], [1440, 900], [600, 700], [1280, 720]]) {
    Object.assign(root.style, { width: `${width}px`, height: `${height}px`, minHeight: `${width < 760 ? 640 : 540}px`, inset: "auto" });
    await expect.poll(() => originalCanvas.width).toBe(width);
    await expect.poll(() => originalCanvas.height).toBe(height);
    expect(document.querySelector("canvas")).toBe(originalCanvas);
    const l = getSceneLayout(width, height);
    const player = document.querySelector<HTMLElement>(".scene-youtube-screen")!;
    await expect.poll(() => player.offsetWidth).toBe(Math.round(l.screen.width));
    for (let i = 0; i < l.tapes.length; i++) {
      const button = document.querySelector<HTMLElement>(`[data-tape-index="${i}"]`)!;
      expect(parseFloat(button.style.left)).toBeCloseTo(l.tapes[i].x);
      expect(parseFloat(button.style.top)).toBeCloseTo(l.tapes[i].y);
    }
    const corner = getComputedStyle(player);
    expect(parseFloat(corner.borderTopLeftRadius)).toBeGreaterThan(0);
    const logo = document.querySelector<HTMLElement>(".brand-logo")!;
    await expect.poll(() => logo.offsetWidth).toBe(Math.round(l.logo.width));
    expect(logo.getBoundingClientRect().left + logo.getBoundingClientRect().width / 2).toBeCloseTo(player.getBoundingClientRect().left + player.getBoundingClientRect().width / 2, 0);
    expect(logo.getBoundingClientRect().bottom).toBeLessThanOrEqual(player.getBoundingClientRect().top);
    expect(document.querySelectorAll("[data-tape-index]")).toHaveLength(4);
    // A cleared/black WebGL buffer has one color; a rendered room has many.
    const snapshot = document.createElement("canvas"); snapshot.width = 64; snapshot.height = 64;
    const ctx = snapshot.getContext("2d")!;
    ctx.drawImage(originalCanvas, 0, 0, 64, 64);
    const pixels = ctx.getImageData(0, 0, 64, 64).data;
    const colors = new Set<string>();
    for (let i = 0; i < pixels.length; i += 4) colors.add(`${pixels[i]},${pixels[i + 1]},${pixels[i + 2]}`);
    expect(colors.size).toBeGreaterThan(30);
  }
});


test.each([[390, 844], [1440, 900]])("one click swaps panels at %i × %i, preserving the draft", async (width, height) => {
  const initialViewport = [window.innerWidth, window.innerHeight];
  await render(<StreamEmbed videoId="" />);
  try {
    await page.viewport(width, height);
    // clickThroughBackdrop below reads tape positions that a ResizeObserver
    // sets after the viewport change, not the resize itself; without this, a
    // slow reflow leaves it clicking where a tape used to be.
    await expect.poll(() => document.querySelector("canvas")?.width).toBe(width);
    // TEMP DEBUG: narrowing a CI-only timeout in this test.
    console.log("DEBUG post-resize", JSON.stringify({
      innerWidth: window.innerWidth, innerHeight: window.innerHeight,
      playerRect: document.querySelector(".scene-player")?.getBoundingClientRect(),
      canvas: { w: document.querySelector("canvas")?.width, h: document.querySelector("canvas")?.height },
    }));
    await tape(1).click();
    console.log("DEBUG tape(1) clicked");
    await page.getByRole("textbox", { name: "Name", exact: true }).fill("Draft Viewer");
    console.log("DEBUG name filled");
    const clickThroughBackdrop = async (index: number) => {
      const target = document.querySelector<HTMLElement>(`[data-tape-index="${index}"]`)!;
      const bounds = target.getBoundingClientRect();
      const cx = bounds.x + bounds.width / 2, cy = bounds.y + bounds.height / 2;
      console.log(`DEBUG clickThroughBackdrop(${index})`, JSON.stringify({ bounds, cx, cy }), document.elementFromPoint(cx, cy)?.outerHTML?.slice(0, 300));
      await page.getByTestId("scene-panel-backdrop").click({ position: { x: cx, y: cy } });
      console.log(`DEBUG clickThroughBackdrop(${index}) done`);
    };
    await clickThroughBackdrop(1);
    console.log("DEBUG waiting for Links dialog", document.querySelector('[role="dialog"]')?.outerHTML?.slice(0, 300));
    await expect.element(page.getByRole("dialog", { name: "Links" })).toBeInTheDocument();
    await expect.element(page.getByRole("dialog", { name: "Links" })).toHaveFocus();
    console.log("DEBUG Links dialog confirmed");
    await clickThroughBackdrop(2);
    console.log("DEBUG waiting for Settings dialog", document.querySelector('[role="dialog"]')?.outerHTML?.slice(0, 300));
    await expect.element(page.getByRole("dialog", { name: "Settings" })).toBeInTheDocument();
    console.log("DEBUG Settings dialog confirmed");
    await clickThroughBackdrop(0);
    await expect.element(page.getByRole("textbox", { name: "Name", exact: true })).toHaveValue("Draft Viewer");
    await userEvent.keyboard("{Escape}");
    await expect.element(tape(1)).toHaveFocus();
    console.log("DEBUG test complete");
  } finally {
    await page.viewport(initialViewport[0], initialViewport[1]);
  }
});
