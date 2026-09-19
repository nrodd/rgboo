import { expect } from "vitest";
import { page } from "vitest/browser";
import { test } from "./setup/test-extend";
import { renderApp } from "./setup/test-utils";

test("the homepage is a full viewport canvas without the old page UI", async () => {
  await renderApp();
  await expect.element(page.getByTestId("stream-embed-container")).toBeInTheDocument();
  await expect.poll(() => document.querySelectorAll(".scene-canvas-host canvas").length).toBe(1);
  const canvas = document.querySelector("canvas")!.getBoundingClientRect();
  expect(canvas.width).toBe(window.innerWidth);
  expect(canvas.height).toBe(window.innerHeight);
  expect(document.querySelector('[data-testid="info-button"]')).toBeNull();
  expect(document.querySelector('[data-testid="color-form-container"]')).toBeNull();
  expect(document.querySelector('[data-testid="footer"]')).toBeNull();
  expect(document.querySelector(".scene-controls")).toBeNull();
});
