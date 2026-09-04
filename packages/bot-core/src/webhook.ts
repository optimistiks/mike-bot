import { Bot, webhookCallback } from "grammy";

import type { BotDatabase } from "./db/runtime.js";

import { createBot } from "./bot.js";

const TELEGRAM_WEBHOOK_ALLOWED_UPDATES = ["message", "channel_post"] as const;

interface TelegramWebhookDependencies {
  db: BotDatabase;
  secretToken: string;
  timeoutMilliseconds: number;
  token: string;
}

interface RegisterTelegramWebhookInput {
  secretToken: string;
  token: string;
  webhookUrl: string;
}

interface RegisteredTelegramWebhook {
  allowed_updates: string[];
  url: string;
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

async function publishStatsCommand(bot: Bot): Promise<void> {
  const statsCommand = {
    command: "stats",
    description: "Таблицы",
  };
  await bot.api.setMyCommands([statsCommand]);
  await bot.api.setMyCommands([{ ...statsCommand, is_ephemeral: true }], {
    scope: { type: "all_group_chats" },
  });
}

function assertWebhookUrlMatches(expected: string, actual: string | undefined): void {
  if (actual === expected) {
    return;
  }
  throw new Error(`Webhook URL mismatch: expected ${expected}, got ${actual ?? "(none)"}`);
}

async function registerTelegramWebhook({
  secretToken,
  token,
  webhookUrl,
}: RegisterTelegramWebhookInput): Promise<RegisteredTelegramWebhook> {
  const bot = new Bot(token);
  await bot.api.setWebhook(webhookUrl, {
    allowed_updates: [...TELEGRAM_WEBHOOK_ALLOWED_UPDATES],
    secret_token: secretToken,
  });
  await publishStatsCommand(bot);
  const info = await bot.api.getWebhookInfo();
  assertWebhookUrlMatches(webhookUrl, info.url);
  return {
    allowed_updates: [...(info.allowed_updates ?? [])],
    url: webhookUrl,
  };
}

export {
  createTelegramWebhook,
  registerTelegramWebhook,
  type RegisterTelegramWebhookInput,
  type RegisteredTelegramWebhook,
  type TelegramWebhookDependencies,
};
