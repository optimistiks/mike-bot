#!/usr/bin/env node
/**
 * Register the Telegram webhook for the Hono bot.
 *
 *   BOT_TOKEN=... \
 *   BOT_WEBHOOK_SECRET=... \
 *   WEBHOOK_URL=https://your-app.vercel.app/api/telegram \
 *   pnpm set-webhook
 */

import { Bot } from "grammy";
import { config as loadDotenv } from "dotenv";

import { TELEGRAM_WEBHOOK_ALLOWED_UPDATES } from "../src/webhook";

loadDotenv({ path: [".env.local", ".env"] });

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

async function main(): Promise<void> {
  const token = requireEnv("BOT_TOKEN");
  const secret = requireEnv("BOT_WEBHOOK_SECRET");
  const webhookUrl = requireEnv("WEBHOOK_URL");
  const bot = new Bot(token);

  await bot.api.setWebhook(webhookUrl, {
    secret_token: secret,
    allowed_updates: [...TELEGRAM_WEBHOOK_ALLOWED_UPDATES],
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

  console.log("Webhook registered successfully");
  console.log(`  url: ${info.url}`);
  console.log(`  allowed_updates: ${JSON.stringify(info.allowed_updates)}`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
