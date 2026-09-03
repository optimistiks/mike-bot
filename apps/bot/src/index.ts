import { Hono } from "hono";

import { createBot } from "./bot.js";
import { getProductionDb } from "./db/production.js";
import { databaseUrl, requireEnv } from "./env.js";

const app = new Hono();
const { handleWebhook } = createBot({
  db: getProductionDb(databaseUrl()),
  secretToken: requireEnv("BOT_WEBHOOK_SECRET"),
  token: requireEnv("BOT_TOKEN"),
});

app.get("/", (context) => context.text("ok"));
app.post("/api/telegram", (context) => handleWebhook(context.req.raw));

// eslint-disable-next-line import/no-default-export -- Vercel Hono entry
export default app;
