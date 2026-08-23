import "server-only";

import { webhookCallback } from "grammy";

import { getRuntimeDb } from "@/lib/db/runtime";
import { parseServerEnv } from "@/lib/env.server";

import { createBot } from "@/lib/bot/bot";
import { webhookHandlerOptions } from "@/lib/bot/webhook-setup";

// Next.js requires a literal here. `WEBHOOK_MAX_DURATION_SECONDS` mirrors it and
// route.test.ts holds the two together.
export const maxDuration = 60;

let handlerPromise: ReturnType<typeof createWebhookHandler> | undefined;

async function createWebhookHandler() {
  const env = parseServerEnv();
  const db = await getRuntimeDb();
  const bot = createBot({ db, token: env.BOT_TOKEN });

  return webhookCallback(
    bot,
    "std/http",
    webhookHandlerOptions(env.BOT_WEBHOOK_SECRET),
  );
}

export async function POST(request: Request): Promise<Response> {
  handlerPromise ??= createWebhookHandler();
  const handler = await handlerPromise;

  return handler(request);
}
