import { expect } from "vitest";
import { page } from "vitest/browser";
import { render } from "vitest-browser-react";
import { http, HttpResponse, delay } from "msw";
import { SetupWorker } from "msw/browser";
import { test } from "./setup/test-extend";
import Admin from "../Admin";

const statusBody = {
  current_username: "Sally",
  queue_size: 2,
  queue: [
    { request_id: "req-1", username: "Zero", queue_position: 1, estimated_wait_seconds: 0 },
    { request_id: "req-2", username: "Oogie", queue_position: 2, estimated_wait_seconds: 40 },
  ],
};

const mockStatus = (worker: SetupWorker) =>
  worker.use(http.get("*/admin-api/status", () => HttpResponse.json(statusBody)));

test("renders the current user and the pending queue", async ({ worker }: { worker: SetupWorker }) => {
  mockStatus(worker);
  render(<Admin />);

  await expect.element(page.getByText("Sally")).toBeInTheDocument();
  await expect.element(page.getByText("Oogie")).toBeInTheDocument();
  await expect.element(page.getByRole("button", { name: "Remove Zero from queue" })).toBeInTheDocument();
  await expect.element(page.getByRole("button", { name: "Remove Oogie from queue" })).toBeInTheDocument();
});

test("removing one guest only disables that guest's button", async ({ worker }: { worker: SetupWorker }) => {
  mockStatus(worker);
  // Hold the remove open so the pending state is observable mid-flight.
  worker.use(http.post("*/admin-api/queue/remove", async () => {
    await delay(200);
    return HttpResponse.json({ status: "success" });
  }));
  render(<Admin />);

  const removeZero = page.getByRole("button", { name: "Remove Zero from queue" });
  const removeOogie = page.getByRole("button", { name: "Remove Oogie from queue" });
  await expect.element(removeZero).toBeInTheDocument();

  // Auto-confirm the window.confirm the action fires.
  const originalConfirm = window.confirm;
  window.confirm = () => true;
  try {
    await removeZero.click();
    // Zero's button shows its own spinner; Oogie's stays clickable.
    await expect.element(page.getByText("Removing…")).toBeInTheDocument();
    await expect.element(removeOogie).toBeEnabled();
  } finally {
    window.confirm = originalConfirm;
  }
});
