import { captureRouterTransitionStart, init } from "@sentry/nextjs";

import { FULL_SAMPLE_RATE, PRODUCTION_FALLBACK_RATE } from "./sentry-sampling";

function publicSentryDsn(): string | undefined {
  // eslint-disable-next-line node/no-process-env -- Next.js inlines NEXT_PUBLIC_ values into the client bundle
  return process.env.NEXT_PUBLIC_SENTRY_DSN;
}

function clientTracesSampleRate(): number {
  // eslint-disable-next-line node/no-process-env -- NODE_ENV is not an app secret
  if (process.env.NODE_ENV === "development") {
    return FULL_SAMPLE_RATE;
  }
  return PRODUCTION_FALLBACK_RATE;
}

init({
  dsn: publicSentryDsn(),
  tracesSampleRate: clientTracesSampleRate(),
});

const onRouterTransitionStart = captureRouterTransitionStart;

export { onRouterTransitionStart };
