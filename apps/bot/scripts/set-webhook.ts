#!/usr/bin/env node
/**
 * Register the Telegram webhook for the Hono bot.
 *
 *   BOT_TOKEN=... \
 *   BOT_WEBHOOK_SECRET=... \
 *   WEBHOOK_URL=https://your-app.vercel.app/api/telegram \
 *   pnpm set-webhook
 */

import { config as loadDotenv } from "dotenv";
import { Bot } from "grammy";

import { requireEnv } from "#src/env.js";
import { logError, logInfo } from "#src/log.js";
import { TELEGRAM_WEBHOOK_ALLOWED_UPDATES } from "#src/webhook.js";

loadDotenv({ path: [".env.local", ".env"] });

async function main(): Promise<void> {
  const token = requireEnv("BOT_TOKEN");
  const secret = requireEnv("BOT_WEBHOOK_SECRET");
  const webhookUrl = requireEnv("WEBHOOK_URL");
  const bot = new Bot(token);

  await bot.api.setWebhook(webhookUrl, {
    allowed_updates: [...TELEGRAM_WEBHOOK_ALLOWED_UPDATES],
    secret_token: secret,
  });

  const statsCommand = {
    command: "stats",
    description: "Таблицы",
  };
  await bot.api.setMyCommands([statsCommand]);
  await bot.api.setMyCommands([{ ...statsCommand, is_ephemeral: true }], {
    scope: { type: "all_group_chats" },
  });

  const info = await bot.api.getWebhookInfo();
  if (info.url !== webhookUrl) {
    throw new Error(`Webhook URL mismatch: expected ${webhookUrl}, got ${info.url ?? "(none)"}`);
  }

  logInfo("Webhook registered successfully");
  logInfo(`  url: ${info.url}`);
  logInfo(`  allowed_updates: ${JSON.stringify(info.allowed_updates)}`);
}

try {
  // eslint-disable-next-line node/no-top-level-await -- ESM script entry, never require()'d
  await main();
} catch (error: unknown) {
  logError("set-webhook failed", error);
  process.exitCode = 1;
}
