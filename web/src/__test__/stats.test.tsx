import { expect, describe, it } from "vitest";
import { page } from "vitest/browser";
import { render } from "vitest-browser-react";
import { http, HttpResponse } from "msw";
import { SetupWorker } from "msw/browser";
import { MemoryRouter } from "react-router-dom";
import { test } from "./setup/test-extend";
import Stats from "../Stats";
import { hexToRgba, intensityFor, formatHour, INTENSITY_STEPS } from "../Stats/format";

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
    peak_hour_count: 80,
    top_colors: [
      { key: "1", label: "orange", hex: "#e36810", count: 90, share: 0.608 },
      { key: "9", label: "violet", hex: "#6441a4", count: 58, share: 0.392 },
    ],
  },
  grid: [
    { date: "2026-10-29", count: 0, hours: [] },
    {
      date: "2026-10-30",
      count: 28,
      hours: [{ h: 21, n: 28, hex: "#6441a4", label: "violet" }],
    },
    {
      date: "2026-10-31",
      count: 120,
      hours: [
        { h: 20, n: 80, hex: "#e36810", label: "orange" },
        { h: 21, n: 40, hex: "#101010", label: "near black" },
      ],
    },
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
  // The peak hour reads as a time, not as "20". Scoped to the tiles, since
  // "8 PM" is also a legitimate row label on the grid.
  await expect.element(summary.getByText("8 PM")).toBeInTheDocument();
});

test("labels every heatmap cell, busy or empty", async ({ worker }: { worker: SetupWorker }) => {
  mockStats(worker);
  renderStats();

  await expect
    .element(page.getByRole("gridcell", { name: /Oct 31 8 PM, 80 colours, mostly orange/ }))
    .toBeInTheDocument();
  // An hour nobody used must say so, rather than being an unlabelled square.
  await expect
    .element(page.getByRole("gridcell", { name: /Oct 29 7 PM, no colours/ }))
    .toBeInTheDocument();
  // Rows nobody ever used are dropped, and the header says which.
  await expect.element(page.getByText(/Hours with no colours all window/)).toBeInTheDocument();
  await expect
    .element(page.getByRole("gridcell", { name: /3 AM/ }))
    .not.toBeInTheDocument();
});

test("hovering a cell reveals the count and the colour", async ({ worker }: { worker: SetupWorker }) => {
  mockStats(worker);
  renderStats();

  const cell = page.getByRole("gridcell", { name: /Oct 30 9 PM, 28 colours/ });
  await expect.element(cell).toBeInTheDocument();
  await cell.hover();

  await expect.element(page.getByRole("tooltip")).toBeInTheDocument();
  await expect.element(page.getByText("28 colours")).toBeInTheDocument();
  await expect.element(page.getByText(/mostly violet/)).toBeInTheDocument();
});

test("changing the range refetches for that window", async ({ worker }: { worker: SetupWorker }) => {
  mockStats(worker);
  const requested: string[] = [];
  worker.use(http.get("*/api/stats", ({ request }) => {
    requested.push(new URL(request.url).searchParams.get("days") ?? "");
    return HttpResponse.json(statsBody);
  }));
  renderStats();

  await expect.element(page.getByText("148")).toBeInTheDocument();
  await page.getByRole("button", { name: "Last 7 days" }).click();

  await expect.poll(() => requested).toContain("7");
});

test("the table view exposes the same numbers without hovering", async ({ worker }: { worker: SetupWorker }) => {
  mockStats(worker);
  renderStats();

  await page.getByRole("button", { name: "Show table" }).click();

  await expect.element(page.getByRole("table")).toBeInTheDocument();
  const table = page.getByRole("table");
  await expect.element(table.getByText(/8 PM: 80 colours \(orange\)/)).toBeInTheDocument();
  // A day with nothing on it is omitted rather than listed as a zero row.
  // Scoped to the table: "Oct 29" is still a legitimate axis tick on the grid.
  await expect.element(table.getByText(/Oct 29/)).not.toBeInTheDocument();
});

test("ranks the most-picked colours with their share", async ({ worker }: { worker: SetupWorker }) => {
  mockStats(worker);
  renderStats();

  await expect.element(page.getByText("orange")).toBeInTheDocument();
  await expect.element(page.getByText(/90 · 61%/)).toBeInTheDocument();
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
      busiest_day: null, busiest_hour: null, peak_hour_count: 0, top_colors: [],
    },
    grid: [{ date: "2026-10-29", count: 0, hours: [] }],
  });
  renderStats();

  await expect.element(page.getByText(/Nothing has lit up/)).toBeInTheDocument();
  await expect.element(page.getByText("No activity in this window yet")).toBeInTheDocument();
  await expect.element(page.getByText("No colours in this window yet.")).toBeInTheDocument();
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
    // A single-colour hour still clears the empty-cell wash.
    expect(intensityFor(1, 1)).toBe(top);
  });

  it("composites a hex over the surface rather than fading the whole cell", () => {
    expect(hexToRgba("#e36810", 0.4)).toBe("rgba(227, 104, 16, 0.4)");
    expect(hexToRgba("#fff", 1)).toBe("rgba(255, 255, 255, 1)");
  });
});
