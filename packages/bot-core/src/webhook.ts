import { webhookCallback } from "grammy";

import type { BotDatabase } from "./db/runtime.js";

import { createBot } from "./bot.js";

interface TelegramWebhookDependencies {
  db: BotDatabase;
  secretToken: string;
  timeoutMilliseconds: number;
  token: string;
}

type TelegramWebhookHandler = (request: Request) => Promise<Response>;

function createTelegramWebhook({
  db,
  secretToken,
  timeoutMilliseconds,
  token,
}: TelegramWebhookDependencies): TelegramWebhookHandler {
  return webhookCallback(createBot({ db, token }), "std/http", {
    secretToken,
    timeoutMilliseconds,
  });
}

export { createTelegramWebhook, type TelegramWebhookDependencies };
