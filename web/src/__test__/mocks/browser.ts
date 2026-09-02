import { setupWorker } from "msw/browser";
import { http, HttpResponse } from "msw";

const handlers = [
  http.post("*/api/color", () => {
    return HttpResponse.json(
      {
        queue_position: 1,
        estimated_wait_seconds: 0,
      },
      { status: 200 },
    );
  }),
];

export const worker = setupWorker(...handlers);
