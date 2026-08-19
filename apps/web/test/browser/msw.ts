import { setupWorker, type SetupWorker } from "msw/browser";
import { test as base } from "vitest";

const worker = setupWorker();
let started = false;

export const test = base.extend<{ worker: SetupWorker }>({
  worker: [
    async ({}, use) => {
      if (!started) {
        await worker.start({ onUnhandledRequest: "error", quiet: true });
        started = true;
      }
      await use(worker);
      worker.resetHandlers();
    },
    { auto: true },
  ],
});
