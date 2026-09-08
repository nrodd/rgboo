import { expect, describe, it } from "vitest";
import { page } from "vitest/browser";
import { render } from "vitest-browser-react";
import { http, HttpResponse } from "msw";
import { SetupWorker } from "msw/browser";
import { MemoryRouter } from "react-router-dom";
import { test } from "./setup/test-extend";
import Stats from "../Stats";
import {
  hexToRgba,
  intensityFor,
  formatHour,
  rampHex,
  INTENSITY_STEPS,
} from "../Stats/format";

const hours = Array.from({ length: 24 }, (_, h) => ({
  h,
  n: h === 20 ? 96 : h === 21 ? 52 : 0,
}));

const statsBody = {
  timezone: "America/New_York",
  days: 3,
  start_date: "2026-10-29",
  end_date: "2026-10-31",
  generated_at: "2026-10-31T23:00:00+00:00",
  updated_at: "2026-10-31T22:00:00+00:00",
  totals: {
    count: 148,
    active_days: 2,
    avg_per_active_day: 74,
    busiest_day: { date: "2026-10-31", count: 120 },
    busiest_hour: { hour: 20, count: 96 },
    peak_color_day: 80,
    hours,
    colors: [
      { key: "1", label: "orange", hex: "#e36810", count: 90, share: 0.608 },
      { key: "9", label: "violet", hex: "#6441a4", count: 40, share: 0.27 },
      { key: "dark", label: "near black", hex: "#101014", count: 18, share: 0.122 },
    ],
    swatches: [
      { hex: "#e06810", n: 60 },
      { hex: "#f89000", n: 30 },
      { hex: "#6840a8", n: 40 },
      { hex: "#101018", n: 18 },
    ],
  },
  grid: [
    { date: "2026-10-29", count: 0, colors: {} },
    { date: "2026-10-30", count: 28, colors: { "9": 28 } },
    { date: "2026-10-31", count: 120, colors: { "1": 80, "9": 12, dark: 18 } },
  ],
};

const mockStats = (worker: SetupWorker, body: object = statsBody) =>
  worker.use(http.get("*/api/stats", () => HttpResponse.json(body)));

const renderStats = () => render(<MemoryRouter><Stats /></MemoryRouter>);

test("shows the headline totals", async ({ worker }: { worker: SetupWorker }) => {
  mockStats(worker);
  renderStats();

  const summary = page.getByLabelText("Summary");
  await expect.element(summary.getByText("148")).toBeInTheDocument();
  await expect.element(summary.getByText("Busiest night")).toBeInTheDocument();
  await expect.element(summary.getByText("120")).toBeInTheDocument();
  // The peak hour reads as a time, not as "20".
  await expect.element(summary.getByText("8 PM")).toBeInTheDocument();
});

test("draws one square per submission, so area is popularity", async ({ worker }: { worker: SetupWorker }) => {
  mockStats(worker);
  renderStats();

  await expect.element(page.getByText("Every colour picked")).toBeInTheDocument();
  // 60 + 30 + 40 + 18 squares, nothing binned into families.
  await expect.poll(() => document.querySelectorAll(".stats-chip").length).toBe(148);
});

test("keeps the swatch order the API sent, which is the spectrum", async ({ worker }: { worker: SetupWorker }) => {
  mockStats(worker);
  renderStats();

  await expect.poll(() => document.querySelectorAll(".stats-chip").length).toBe(148);
  const hexes = Array.from(document.querySelectorAll<HTMLElement>(".stats-chip"))
    .map((chip) => chip.dataset.hex);
  // Contiguous runs, in the order given: no re-sorting in the component.
  expect(hexes[0]).toBe("#e06810");
  expect(hexes[59]).toBe("#e06810");
  expect(hexes[60]).toBe("#f89000");
  expect(hexes[147]).toBe("#101018");
});

test("states an exact family ranking alongside the mosaic", async ({ worker }: { worker: SetupWorker }) => {
  // Area is a glance, not a number: the bar keeps the precise share.
  mockStats(worker);
  renderStats();

  await expect.element(page.getByText("61%")).toBeInTheDocument();
  await expect.element(page.getByText("27%")).toBeInTheDocument();
});

test("hovering a square reveals its colour and how often it was picked", async ({ worker }: { worker: SetupWorker }) => {
  mockStats(worker);
  renderStats();

  await expect.poll(() => document.querySelectorAll(".stats-chip").length).toBe(148);
  // Hover a specific square: the mosaic's 2px gaps make the container's
  // own centre an unreliable target.
  const chip = document.querySelector<HTMLElement>(".stats-chip")!;
  await page.elementLocator(chip).hover();

  const tip = page.getByRole("tooltip");
  await expect.element(tip).toBeInTheDocument();
  await expect.element(tip).toHaveTextContent("60 picks");
  await expect.element(tip).toHaveTextContent("#e06810");
});

test("shows when the stream is busy, separately from which colour", async ({ worker }: { worker: SetupWorker }) => {
  mockStats(worker);
  renderStats();

  await expect.element(page.getByText("Busiest hours")).toBeInTheDocument();
  await expect.element(page.getByText("8 PM: 96 colours")).toBeInTheDocument();
});

test("changing the range refetches for that window", async ({ worker }: { worker: SetupWorker }) => {
  mockStats(worker);
  const requested: string[] = [];
  worker.use(http.get("*/api/stats", ({ request }) => {
    requested.push(new URL(request.url).searchParams.get("days") ?? "");
    return HttpResponse.json(statsBody);
  }));
  renderStats();

  await expect.element(page.getByLabelText("Summary").getByText("148")).toBeInTheDocument();
  await page.getByRole("button", { name: "Last 7 days" }).click();

  await expect.poll(() => requested).toContain("7");
});

test("the table view exposes the same numbers without hovering", async ({ worker }: { worker: SetupWorker }) => {
  mockStats(worker);
  renderStats();

  await page.getByRole("button", { name: "Show table" }).click();

  const table = page.getByRole("table");
  await expect.element(table.getByText(/orange: 80 colours/)).toBeInTheDocument();
  await expect.element(table.getByText(/near black: 18 colours/)).toBeInTheDocument();
  // A day with nothing on it is omitted rather than listed as a zero row.
  await expect.element(table.getByText(/Oct 29/)).not.toBeInTheDocument();
});

test("surfaces an API failure instead of an empty page", async ({ worker }: { worker: SetupWorker }) => {
  worker.use(http.get("*/api/stats", () =>
    HttpResponse.json({ error: "Stats are not available" }, { status: 503 })));
  renderStats();

  await expect.element(page.getByRole("alert")).toHaveTextContent("Stats are not available");
});

test("reports an empty window honestly", async ({ worker }: { worker: SetupWorker }) => {
  mockStats(worker, {
    ...statsBody,
    totals: {
      count: 0, active_days: 0, avg_per_active_day: 0,
      busiest_day: null, busiest_hour: null, peak_color_day: 0,
      hours: Array.from({ length: 24 }, (_, h) => ({ h, n: 0 })),
      colors: [],
      swatches: [],
    },
    grid: [{ date: "2026-10-29", count: 0, colors: {} }],
  });
  renderStats();

  await expect.element(page.getByText(/Nothing has lit up/)).toBeInTheDocument();
  await expect.element(page.getByText("No activity in this window yet")).toBeInTheDocument();
  await expect.element(page.getByText("No colours in this window yet.").first()).toBeInTheDocument();
});

describe("formatting", () => {
  it("names hours the way people say them", () => {
    expect(formatHour(0)).toBe("12 AM");
    expect(formatHour(12)).toBe("12 PM");
    expect(formatHour(20)).toBe("8 PM");
  });

  it("steps intensity in discrete bands, not a continuous ramp", () => {
    const top = INTENSITY_STEPS[INTENSITY_STEPS.length - 1];
    expect(intensityFor(0, 80)).toBe(0);
    expect(intensityFor(80, 80)).toBe(top);
    expect(intensityFor(1, 80)).toBe(INTENSITY_STEPS[0]);
    expect(intensityFor(1, 1)).toBe(top);
  });

  it("composites a hex over the surface rather than fading the whole cell", () => {
    expect(hexToRgba("#e36810", 0.4)).toBe("rgba(227, 104, 16, 0.4)");
    expect(hexToRgba("#fff", 1)).toBe("rgba(255, 255, 255, 1)");
  });

  it("lifts a near-black row to something visible on the dark card", () => {
    // Without this the whole "near black" row renders as an empty row,
    // whatever its counts are.
    const lifted = rampHex("#101014");
    expect(lifted).not.toBe("#101014");
    expect(Number.parseInt(lifted.slice(1, 3), 16)).toBeGreaterThan(0x10);
  });

  it("leaves an already-light colour alone", () => {
    expect(rampHex("#e36810")).toBe("#e36810");
    expect(rampHex("#ffffff")).toBe("#ffffff");
  });
});
