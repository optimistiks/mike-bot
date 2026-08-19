#!/usr/bin/env node
/**
 * Register the production Telegram webhook (ticket 27).
 *
 * Local / deploy-time only — not invoked on Vercel runtime.
 *
 * Usage:
 *   BOT_TOKEN=... \
 *   BOT_WEBHOOK_SECRET=... \
 *   WEBHOOK_URL=https://your-app.vercel.app/api/telegram \
 *   pnpm --filter @mike-bot/web set-webhook
 *
 * `BOT_WEBHOOK_SECRET` must match Vercel env and `webhookCallback({ secretToken })`.
 */

import { Bot } from "grammy";

import {
  assertWebhookRegistered,
  TELEGRAM_WEBHOOK_ALLOWED_UPDATES,
} from "../lib/bot/webhook-setup";
import { loadEnvFiles } from "../lib/load-env-files";

loadEnvFiles();

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

function readWebhookUrl(): string {
  const raw = requireEnv("WEBHOOK_URL");
  const url = new URL(raw);

  if (url.protocol !== "https:") {
    throw new Error("WEBHOOK_URL must use https");
  }

  if (!url.pathname.endsWith("/api/telegram")) {
    throw new Error(
      "WEBHOOK_URL must point at the webhook Route Handler (/api/telegram)",
    );
  }

  return url.toString().replace(/\/$/, "");
}

async function main(): Promise<void> {
  const token = requireEnv("BOT_TOKEN");
  const secret = requireEnv("BOT_WEBHOOK_SECRET");
  const webhookUrl = readWebhookUrl();

  const bot = new Bot(token);

  await bot.api.setWebhook(webhookUrl, {
    secret_token: secret,
    allowed_updates: [...TELEGRAM_WEBHOOK_ALLOWED_UPDATES],
  });

  const info = await bot.api.getWebhookInfo();
  if (!info.url) {
    throw new Error("getWebhookInfo returned no url after setWebhook");
  }

  assertWebhookRegistered(info, {
    url: webhookUrl,
    allowedUpdates: TELEGRAM_WEBHOOK_ALLOWED_UPDATES,
  });

  console.log("Webhook registered successfully");
  console.log(`  url: ${info.url}`);
  console.log(`  allowed_updates: ${JSON.stringify(info.allowed_updates)}`);
  if (info.pending_update_count > 0) {
    console.log(`  pending_update_count: ${String(info.pending_update_count)}`);
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
