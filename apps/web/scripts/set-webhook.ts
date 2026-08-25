#!/usr/bin/env node
/**
 * Register the production Telegram webhook (ticket 27), or hand the bot back
 * to the v1 AWS deployment.
 *
 * Local / deploy-time only — not invoked on Vercel runtime.
 *
 * Usage:
 *   BOT_TOKEN=... \
 *   BOT_WEBHOOK_SECRET=... \
 *   WEBHOOK_URL=https://your-app.vercel.app/api/telegram \
 *   pnpm set-webhook
 *
 * `BOT_WEBHOOK_SECRET` must match Vercel env and `webhookCallback({ secretToken })`.
 *
 * Recovery — re-point the bot at the v1 API Gateway endpoint:
 *   LEGACY_BOT_TOKEN=... \
 *   LEGACY_BOT_WEBHOOK=https://....execute-api.eu-central-1.amazonaws.com/Prod \
 *   pnpm set-webhook --recover
 */

import { Bot } from "grammy";
import { config as loadDotenv } from "dotenv";

import {
  assertWebhookRegistered,
  TELEGRAM_WEBHOOK_ALLOWED_UPDATES,
} from "../lib/bot/webhook-setup";
import { parseWebhookSecret } from "../lib/env";

loadDotenv({ path: [".env.local", ".env"] });

const RECOVER_FLAG = "--recover";

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

function readHttpsUrl(name: string): string {
  const raw = requireEnv(name);
  const url = new URL(raw);

  if (url.protocol !== "https:") {
    throw new Error(`${name} must use https`);
  }

  return url.toString().replace(/\/$/, "");
}

function readWebhookUrl(): string {
  const webhookUrl = readHttpsUrl("WEBHOOK_URL");

  if (!new URL(webhookUrl).pathname.endsWith("/api/telegram")) {
    throw new Error(
      "WEBHOOK_URL must point at the webhook Route Handler (/api/telegram)",
    );
  }

  return webhookUrl;
}

function logWebhook(info: {
  url?: string;
  allowed_updates?: string[];
  pending_update_count: number;
}): void {
  console.log(`  url: ${info.url ?? "(none)"}`);
  console.log(`  allowed_updates: ${JSON.stringify(info.allowed_updates)}`);
  if (info.pending_update_count > 0) {
    console.log(`  pending_update_count: ${String(info.pending_update_count)}`);
  }
}

async function registerWebhook(): Promise<void> {
  const token = requireEnv("BOT_TOKEN");
  const secret = parseWebhookSecret();
  const webhookUrl = readWebhookUrl();

  const bot = new Bot(token);

  await bot.api.setWebhook(webhookUrl, {
    secret_token: secret,
    allowed_updates: [...TELEGRAM_WEBHOOK_ALLOWED_UPDATES],
  });

  const statsCommand = {
    command: "stats",
    description: "Открыть таблицы лидеров",
  };
  const registerCommand = {
    command: "register",
    description: "Получить доступ к таблицам лидеров",
  };
  // Group-only: a reaction belongs to a Chat, so the command means nothing in
  // a private chat with the bot.
  const addReactionCommand = {
    command: "addreaction",
    description: "Добавить реакцию в список группы",
  };
  await bot.api.setMyCommands([
    statsCommand,
    registerCommand,
    addReactionCommand,
  ]);
  await bot.api.setMyCommands([statsCommand], {
    scope: { type: "all_private_chats" },
  });
  // Ephemeral is a group-only concept: in a group the command message itself
  // stays invisible to everyone but the sender and the bot.
  await bot.api.setMyCommands(
    [
      { ...statsCommand, is_ephemeral: true },
      { ...registerCommand, is_ephemeral: true },
      { ...addReactionCommand, is_ephemeral: true },
    ],
    { scope: { type: "all_group_chats" } },
  );

  const info = await bot.api.getWebhookInfo();
  if (!info.url) {
    throw new Error("getWebhookInfo returned no url after setWebhook");
  }

  assertWebhookRegistered(info, {
    url: webhookUrl,
    allowedUpdates: TELEGRAM_WEBHOOK_ALLOWED_UPDATES,
  });

  console.log("Webhook registered successfully");
  logWebhook(info);
}

/**
 * Hand the bot back to the v1 AWS Lambda (`master:src/index.ts`).
 *
 * That handler reads `event.body` and nothing else — it never inspects
 * `X-Telegram-Bot-Api-Secret-Token` — so omitting the secret both matches what
 * v1 expects and clears the one v2 registered.
 *
 * `allowed_updates`, unlike the secret, is sticky: the Bot API documents "if
 * not specified, the previous setting will be used", so leaving it out would
 * strand v1's Telegraf bot on v2's narrowed list. The empty list is not a
 * no-op here — it is the documented way to ask for the default set.
 */
async function recoverLegacyWebhook(): Promise<void> {
  const token = requireEnv("LEGACY_BOT_TOKEN");
  const webhookUrl = readHttpsUrl("LEGACY_BOT_WEBHOOK");

  const bot = new Bot(token);

  await bot.api.setWebhook(webhookUrl, { allowed_updates: [] });

  // v1 registered no commands at all. Leaving v2's behind would keep
  // advertising /stats and /register in a menu the Lambda ignores.
  await bot.api.setMyCommands([]);
  await bot.api.setMyCommands([], { scope: { type: "all_private_chats" } });
  await bot.api.setMyCommands([], { scope: { type: "all_group_chats" } });

  const info = await bot.api.getWebhookInfo();

  assertWebhookRegistered(info, { url: webhookUrl, allowedUpdates: [] });

  // Telegram reports the default set by omitting the field, so anything left
  // here is v2's list surviving the handover — the failure this mode exists to
  // prevent, and one `assertWebhookRegistered` cannot see with no expectations.
  if (info.allowed_updates && info.allowed_updates.length > 0) {
    throw new Error(
      `Webhook still restricted to ${JSON.stringify(info.allowed_updates)}; expected Telegram's default set`,
    );
  }

  console.log("Webhook handed back to the legacy AWS endpoint");
  logWebhook(info);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const unknown = args.filter((arg) => arg !== RECOVER_FLAG);

  // A typo'd recovery flag would otherwise fall through to the normal path and
  // re-point production at v2 — the opposite of what the operator asked for.
  if (unknown.length > 0) {
    throw new Error(
      `Unknown argument(s): ${unknown.join(", ")}. Usage: set-webhook [${RECOVER_FLAG}]`,
    );
  }

  if (args.includes(RECOVER_FLAG)) {
    await recoverLegacyWebhook();
    return;
  }

  await registerWebhook();
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
