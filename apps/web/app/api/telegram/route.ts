import "server-only";

import { webhookCallback } from "grammy";

import { getRuntimeDb } from "@/lib/db/runtime";
import { parseServerEnv } from "@/lib/env.server";

import { createBot } from "@/lib/bot/bot";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 10;

export async function POST(request: Request): Promise<Response> {
  const env = parseServerEnv();
  const db = await getRuntimeDb();
  const bot = createBot({ db, token: env.BOT_TOKEN });
  const handler = webhookCallback(bot, "std/http", {
    secretToken: env.BOT_WEBHOOK_SECRET,
  });

  return handler(request);
}
