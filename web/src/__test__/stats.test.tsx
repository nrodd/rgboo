import { expect, describe, it } from "vitest";
import { page } from "vitest/browser";
import { render } from "vitest-browser-react";
import { http, HttpResponse } from "msw";
import { SetupWorker } from "msw/browser";
import { MemoryRouter } from "react-router-dom";
import { test } from "./setup/test-extend";
import Stats from "../Stats";
import { formatHour, formatHourTick } from "../Stats/format";

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
    hours,
    colors: [
      { key: "1", label: "orange", hex: "#e36810", count: 90, share: 0.608 },
      { key: "9", label: "violet", hex: "#6441a4", count: 40, share: 0.27 },
      { key: "dark", label: "near black", hex: "#101014", count: 18, share: 0.122 },
    ],
    // Deliberately not grouped or hue-ordered: this is arrival order.
    sequence: ["#e06810", "#101018", "#6840a8", "#e06810", "#f89000"],
    sampled: false,
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

test("draws one square per submission", async ({ worker }: { worker: SetupWorker }) => {
  mockStats(worker);
  renderStats();

  await expect.element(page.getByText("Every colour picked")).toBeInTheDocument();
  await expect.poll(() => document.querySelectorAll(".stats-chip").length).toBe(5);
});

test("keeps arrival order, neither grouping nor sorting the colours", async ({ worker }: { worker: SetupWorker }) => {
  mockStats(worker);
  renderStats();

  await expect.poll(() => document.querySelectorAll(".stats-chip").length).toBe(5);
  const rgb = Array.from(document.querySelectorAll<HTMLElement>(".stats-chip"))
    .map((chip) => chip.style.backgroundColor);
  // The two #e06810 picks stay apart, where they actually happened.
  expect(rgb).toEqual([
    "rgb(224, 104, 16)", "rgb(16, 16, 24)", "rgb(104, 64, 168)",
    "rgb(224, 104, 16)", "rgb(248, 144, 0)",
  ]);
});

test("has no hover layer on the squares", async ({ worker }: { worker: SetupWorker }) => {
  mockStats(worker);
  renderStats();

  await expect.poll(() => document.querySelectorAll(".stats-chip").length).toBe(5);
  const chip = document.querySelector<HTMLElement>(".stats-chip")!;
  await page.elementLocator(chip).hover();

  expect(document.querySelector('[role="tooltip"]')).toBeNull();
  expect(chip.getAttribute("title")).toBeNull();
});

test("states an exact family ranking alongside the mosaic", async ({ worker }: { worker: SetupWorker }) => {
  // Arrival order says nothing about which colour won; the bar does.
  mockStats(worker);
  renderStats();

  await expect.element(page.getByText("61%")).toBeInTheDocument();
  await expect.element(page.getByText("27%")).toBeInTheDocument();
});

test("shows all twenty-four hours, busy or not", async ({ worker }: { worker: SetupWorker }) => {
  // The strip runs around the clock, so a quiet hour is a finding rather
  // than an absence and must not be trimmed away.
  mockStats(worker);
  renderStats();

  await expect.element(page.getByText("Busiest hours")).toBeInTheDocument();
  await expect.poll(() => document.querySelectorAll(".stats-hour-col").length).toBe(24);
  await expect.element(page.getByText("8 PM: 96 colours")).toBeInTheDocument();
  await expect.element(page.getByText("3 AM: 0 colours")).toBeInTheDocument();
});

test("always asks for the 30-day window", async ({ worker }: { worker: SetupWorker }) => {
  const requested: string[] = [];
  worker.use(http.get("*/api/stats", ({ request }) => {
    requested.push(new URL(request.url).searchParams.get("days") ?? "");
    return HttpResponse.json(statsBody);
  }));
  renderStats();

  await expect.element(page.getByLabelText("Summary").getByText("148")).toBeInTheDocument();
  expect(requested).toEqual(["30"]);
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

const emptyBody = {
  ...statsBody,
  updated_at: null,
  totals: {
    count: 0, active_days: 0, avg_per_active_day: 0,
    busiest_day: null, busiest_hour: null,
    hours: Array.from({ length: 24 }, (_, h) => ({ h, n: 0 })),
    colors: [],
    sequence: [],
    sampled: false,
  },
  grid: [{ date: "2026-10-29", count: 0, colors: {} }],
};

test("shows the coming-soon placeholder before there is any data", async ({ worker }: { worker: SetupWorker }) => {
  mockStats(worker, emptyBody);
  renderStats();

  await expect.element(page.getByText("Nothing stirs here yet")).toBeInTheDocument();
  await expect.element(page.getByRole("link", { name: "Go pick a colour" })).toBeInTheDocument();
  // The dashboard is replaced, not merely emptied: a grid of zeroes and a
  // flat bar chart read as broken.
  expect(document.querySelector(".stats-chip")).toBeNull();
  expect(document.querySelector(".stats-hour-col")).toBeNull();
  await expect.element(page.getByText(/Updated/)).not.toBeInTheDocument();
});

test("shows the same placeholder when the stats cannot be fetched", async ({ worker }: { worker: SetupWorker }) => {
  // A visitor can do nothing about a 503, and cannot tell it apart from
  // "no data yet" anyway. The error goes to the console instead.
  worker.use(http.get("*/api/stats", () =>
    HttpResponse.json({ error: "Stats are not available" }, { status: 503 })));
  renderStats();

  await expect.element(page.getByText("Nothing stirs here yet")).toBeInTheDocument();
  expect(document.querySelector('[role="alert"]')).toBeNull();
});

test("shows the dashboard, not the placeholder, once data exists", async ({ worker }: { worker: SetupWorker }) => {
  mockStats(worker);
  renderStats();

  await expect.element(page.getByLabelText("Summary")).toBeInTheDocument();
  expect(document.querySelector(".stats-soon")).toBeNull();
});

describe("formatting", () => {
  it("names hours the way people say them", () => {
    expect(formatHour(0)).toBe("12 AM");
    expect(formatHour(12)).toBe("12 PM");
    expect(formatHour(20)).toBe("8 PM");
  });

  it("keeps axis ticks narrow enough that all 24 fit", () => {
    expect(formatHourTick(0)).toBe("12a");
    expect(formatHourTick(12)).toBe("12p");
    expect(formatHourTick(20)).toBe("8");
    expect(formatHourTick(23)).toBe("11");
  });
});
