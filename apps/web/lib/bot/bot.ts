import { Bot } from "grammy";

import type { AppDatabase } from "@/lib/db/runtime";

import { handleTelegramUpdate } from "./handle-update";
import { handleRegisterCommand } from "./register";

export interface BotDependencies {
  db: AppDatabase;
  token: string;
}

export function createBot({ db, token }: BotDependencies): Bot {
  const bot = new Bot(token);

  bot.command("register", async (ctx) => {
    await handleRegisterCommand(db, ctx);
  });

  bot.use(async (ctx, next) => {
    await handleTelegramUpdate(db, ctx.update);
    await next();
  });

  return bot;
}
