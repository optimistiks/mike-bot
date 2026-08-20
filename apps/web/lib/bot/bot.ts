import { Bot, Context } from "grammy";

import type { AppDatabase } from "@/lib/db/runtime";

import { handleTelegramUpdate } from "./handle-update";
import { handleRegisterCommand } from "./register";

export interface BotDependencies {
  db: AppDatabase;
  token: string;
}

export function createBot({ db, token }: BotDependencies): Bot {
  const bot = new Bot(token);
  const isRegisterCommand = Context.has.command("register");

  bot.use(async (ctx) => {
    await handleTelegramUpdate(db, ctx.update, async (transactionDb) => {
      if (isRegisterCommand(ctx)) {
        await handleRegisterCommand(transactionDb, ctx);
      }
    });
  });

  return bot;
}
