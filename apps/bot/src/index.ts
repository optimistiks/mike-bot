import { createBot, schema } from "@mike-bot/bot-core";
import { drizzle as drizzleNodePostgres } from "drizzle-orm/node-postgres";
import { webhookCallback } from "grammy";
import { Hono } from "hono";

import { databaseUrl, requireEnv } from "#src/env.js";
import { getProductionPool } from "#src/production.js";
import { webhookHandlerOptions } from "#src/webhook.js";

const app = new Hono();
const db = drizzleNodePostgres({ client: getProductionPool(databaseUrl()), schema });
const bot = createBot({
  db,
  token: requireEnv("BOT_TOKEN"),
});
const handleWebhook = webhookCallback(
  bot,
  "std/http",
  webhookHandlerOptions(requireEnv("BOT_WEBHOOK_SECRET")),
);

app.get("/", (context) => context.text("ok"));
app.post("/api/telegram", (context) => handleWebhook(context.req.raw));

// eslint-disable-next-line import/no-default-export -- Vercel Hono entry
export default app;
