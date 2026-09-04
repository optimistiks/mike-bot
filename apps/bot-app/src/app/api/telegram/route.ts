import { createTelegramWebhook } from "@mike-bot/bot-core";

import { db } from "@/db";
import { env } from "@/env";

const WEBHOOK_TIMEOUT_PADDING_SECONDS = 5;
const MS_PER_SECOND = 1000;

export const maxDuration = 60;

export const POST = createTelegramWebhook({
  db,
  secretToken: env.BOT_WEBHOOK_SECRET,
  timeoutMilliseconds: (maxDuration + WEBHOOK_TIMEOUT_PADDING_SECONDS) * MS_PER_SECOND,
  token: env.BOT_TOKEN,
});
