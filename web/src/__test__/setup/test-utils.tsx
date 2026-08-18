import { page } from "vitest/browser";
import { render } from "vitest-browser-react";
import App from "../../App";
import { expect } from "vitest";

export async function renderApp() {
  render(<App />);
  await expect.element(page.getByText("RGBOO")).toBeInTheDocument();
}

export function nameInput() {
  return page.getByRole("textbox", { name: "username" });
}

export function submitButton() {
  return page.getByRole("button");
}

export async function fillName(value: string) {
  const input = nameInput();
  await input.fill(value);
  await expect.element(input).toHaveValue(value);
}

export async function clickSubmit() {
  const btn = submitButton();
  await btn.click();
}

export async function submitName(value: string) {
  await fillName(value);
  await clickSubmit();
}

export async function expectPopup(re: RegExp) {
  await expect.element(page.getByText(re)).toBeInTheDocument();
}

export async function expectPopupText(text: string) {
  await expect.element(page.getByText(text)).toBeInTheDocument();
}
