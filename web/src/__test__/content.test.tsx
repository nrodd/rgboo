import { expect } from "vitest";
import { page } from "vitest/browser";
import { test } from "./setup/test-extend";
import { renderApp } from "./setup/test-utils";

test("then the content is rendered", async () => {
  await renderApp();

  await expect.element(page.getByTestId("info-button")).toBeInTheDocument();

  await expect
    .element(page.getByTestId("twitch-embed-container"))
    .toBeInTheDocument();

  await expect
    .element(page.getByTestId("color-form-container"))
    .toBeInTheDocument();

  await expect.element(page.getByTestId("footer")).toBeInTheDocument();
});
