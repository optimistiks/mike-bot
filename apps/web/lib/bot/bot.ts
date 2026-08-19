import { Bot } from "grammy";

import type { AppDatabase } from "@/lib/db/runtime";

import { handleTelegramUpdate } from "./handle-update";

export interface BotDependencies {
  db: AppDatabase;
  token: string;
}

export function createBot({ db, token }: BotDependencies): Bot {
  const bot = new Bot(token);

  bot.use(async (ctx, next) => {
    await handleTelegramUpdate(db, ctx.update);
    await next();
  });

  return bot;
}
