import { test as testBase } from "vitest";
import { worker } from "../mocks/browser";

let start: ReturnType<typeof worker.start> | undefined;
export const test = testBase.extend({
  worker: [
    async ({}, use) => {
      start ??= worker.start({ quiet: true });
      await start;
      try {
        await use(worker);
      } finally {
        worker.resetHandlers();
      }
    },
    { auto: true },
  ],
});
