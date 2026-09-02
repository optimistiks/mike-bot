import { Hono } from "hono";

import { createBot } from "./bot";
import { getProductionDb } from "./db/production";
import { databaseUrl, requireEnv } from "./env";

export function createApp(): Hono {
  const app = new Hono();
  const { handleWebhook } = createBot({
    db: getProductionDb(databaseUrl()),
    token: requireEnv("BOT_TOKEN"),
    secretToken: requireEnv("BOT_WEBHOOK_SECRET"),
  });

  app.get("/", (c) => c.text("ok"));
  app.post("/api/telegram", async (c) => handleWebhook(c.req.raw));

  return app;
}
