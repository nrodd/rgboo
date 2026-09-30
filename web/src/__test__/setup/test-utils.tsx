import { page } from "vitest/browser";
import { render } from "vitest-browser-react";
import App from "../../App";
import ColorForm from "../../components/ColorForm";
import { expect } from "vitest";
import type { YouTubeAPI } from "../../media/youtubePlayer";

export async function renderApp() {
  render(<App />);
  await expect.element(page.getByRole("main", { name: "RGBOO" })).toBeInTheDocument();
}

// The app embeds the real channel by default, which would otherwise have
// createYouTubePlayer inject a real <script src=".../iframe_api"> and contact
// YouTube. Short-circuits loadYouTubeAPI's `window.YT?.Player` check instead.
export function stubYouTubeApi() {
  const player = {
    playVideo() {}, pauseVideo() {}, mute() {}, unMute() {},
    setVolume() {}, getVolume: () => 70, isMuted: () => true,
    getPlayerState: () => -1, destroy() {},
  };
  window.YT = { Player: class { constructor(_element: HTMLIFrameElement, _options: ConstructorParameters<YouTubeAPI["Player"]>[1]) { return player; } } as YouTubeAPI["Player"] };
}

export async function renderColorForm() {
  await render(<ColorForm />);
}

export function nameInput() {
  return page.getByRole("textbox", { name: "username" });
}

export function submitButton() {
  return page.getByRole("button", { name: "Send", exact: true });
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
