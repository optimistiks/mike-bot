#!/usr/bin/env node
/**
 * Register the Telegram webhook.
 *
 *   BOT_TOKEN=... \
 *   BOT_WEBHOOK_SECRET=... \
 *   WEBHOOK_URL=https://your-app.vercel.app/api/telegram \
 *   pnpm set-webhook
 */

import { config as loadDotenv } from "dotenv";
import { z } from "zod";

import { registerTelegramWebhook } from "../src/webhook.js";

loadDotenv({ path: [".env.local", ".env"] });

const NONEMPTY_LENGTH = 1;
const nonemptyString = z.string().trim().min(NONEMPTY_LENGTH);

const scriptEnvSchema = z.object({
  BOT_TOKEN: nonemptyString,
  BOT_WEBHOOK_SECRET: nonemptyString,
  WEBHOOK_URL: nonemptyString,
});

async function main(): Promise<void> {
  // eslint-disable-next-line node/no-process-env -- this script is an env seam
  const scriptEnv = scriptEnvSchema.parse(process.env);
  const info = await registerTelegramWebhook({
    secretToken: scriptEnv.BOT_WEBHOOK_SECRET,
    token: scriptEnv.BOT_TOKEN,
    webhookUrl: scriptEnv.WEBHOOK_URL,
  });

  // eslint-disable-next-line no-console -- CLI progress
  console.log("Webhook registered successfully");
  // eslint-disable-next-line no-console -- CLI progress
  console.log(`  url: ${info.url}`);
  // eslint-disable-next-line no-console -- CLI progress
  console.log(`  allowed_updates: ${JSON.stringify(info.allowed_updates)}`);
}

try {
  // eslint-disable-next-line node/no-top-level-await -- ESM script entry, never require()'d
  await main();
} catch (error: unknown) {
  // eslint-disable-next-line no-console -- CLI failure
  console.error("set-webhook failed", error);
  process.exitCode = 1;
}
