import { captureRequestError } from "@sentry/nextjs";

function nextRuntime(): string | undefined {
  // eslint-disable-next-line node/no-process-env -- Next.js sets NEXT_RUNTIME for instrumentation
  return process.env.NEXT_RUNTIME;
}

async function register(): Promise<void> {
  if (nextRuntime() === "nodejs") {
    await import("./sentry.server.config");
  }

  if (nextRuntime() === "edge") {
    await import("./sentry.edge.config");
  }
}

const onRequestError = captureRequestError;

export { onRequestError, register };
