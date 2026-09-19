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
  await expect.element(page.getByRole("link", { name: /Twitch/ })).toHaveAttribute("href", "https://twitch.tv/roddzillaaa");
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
});

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
    for (let i = 0; i < 5; i++) {
      const button = document.querySelector<HTMLElement>(`[data-tape-index="${i}"]`)!;
      expect(parseFloat(button.style.left)).toBeCloseTo(l.tapes[i].x);
      expect(parseFloat(button.style.top)).toBeCloseTo(l.tapes[i].y);
    }
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
