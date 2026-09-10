import { init, vercelAIIntegration } from "@sentry/nextjs";

import { sentryDsn } from "./sentry-dsn";
import { tracesSampler } from "./sentry-sampling";

init({
  dsn: sentryDsn(),
  integrations: [vercelAIIntegration()],
  tracesSampler,
});
