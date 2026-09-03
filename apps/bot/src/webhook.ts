import { MS_PER_SECOND } from "#src/constants.js";

const WEBHOOK_MAX_DURATION_SECONDS = 60;
const WEBHOOK_TIMEOUT_PADDING_SECONDS = 5;

const TELEGRAM_WEBHOOK_ALLOWED_UPDATES = ["message", "channel_post"] as const;

function webhookHandlerOptions(secretToken: string): {
  secretToken: string;
  timeoutMilliseconds: number;
} {
  return {
    secretToken,
    timeoutMilliseconds:
      (WEBHOOK_MAX_DURATION_SECONDS + WEBHOOK_TIMEOUT_PADDING_SECONDS) * MS_PER_SECOND,
  };
}

export { TELEGRAM_WEBHOOK_ALLOWED_UPDATES, WEBHOOK_MAX_DURATION_SECONDS, webhookHandlerOptions };
