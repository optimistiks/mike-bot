import { rewriteSentryAiSpan } from "@mike-bot/bot-core";
import { init, vercelAIIntegration } from "@sentry/nextjs";

import { sentryDsn } from "./sentry-dsn";
import { tracesSampler } from "./sentry-sampling";

init({
  beforeSendSpan: rewriteSentryAiSpan,
  dsn: sentryDsn(),
  includeLocalVariables: true,
  integrations: [
    vercelAIIntegration({
      force: true,
      recordInputs: true,
      recordOutputs: true,
    }),
  ],
  tracesSampler,
});
