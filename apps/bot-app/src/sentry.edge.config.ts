import { stampSentrySpanTranscript } from "@mike-bot/bot-core";
import { init, vercelAIIntegration } from "@sentry/nextjs";

import { sentryDsn } from "./sentry-dsn";
import { tracesSampler } from "./sentry-sampling";

init({
  beforeSendSpan: stampSentrySpanTranscript,
  dsn: sentryDsn(),
  integrations: [vercelAIIntegration()],
  tracesSampler,
});
