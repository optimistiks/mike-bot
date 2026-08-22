import { setupWorker, type SetupWorker } from "msw/browser";
import { afterEach, test as base } from "vitest";
import { cleanup } from "vitest-browser-react";

const worker = setupWorker();
let started = false;

// Every browser test starts on an empty page: a tree left mounted by the
// previous test keeps querying, and its requests land in the next test's
// handlers.
afterEach(() => cleanup());

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
