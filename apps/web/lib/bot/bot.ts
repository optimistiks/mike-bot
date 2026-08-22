import { Bot, Context } from "grammy";

import type { AppDatabase } from "@/lib/db/runtime";

import { handleTelegramUpdate } from "./handle-update";
import { handleReplyMark } from "./reply-marks";
import { handleStatsCommand } from "./stats";

export interface BotDependencies {
  db: AppDatabase;
  token: string;
}

export function createBot({ db, token }: BotDependencies): Bot {
  const bot = new Bot(token);
  const isRegisterCommand = Context.has.command("register");
  const isStatsCommand = Context.has.command("stats");

  bot.use(async (ctx) => {
    const replyAcknowledgement = { accepted: false };
    await handleTelegramUpdate(db, ctx.update, async (transactionDb) => {
      // /register is an alias of /stats: both register the caller and reply
      // with the same Mini App deep link.
      if (isRegisterCommand(ctx) || isStatsCommand(ctx)) {
        await handleStatsCommand(transactionDb, ctx);
        return;
      }

      replyAcknowledgement.accepted = await handleReplyMark(transactionDb, ctx);
    });

    if (replyAcknowledgement.accepted) {
      try {
        await ctx.react("👍");
      } catch (error) {
        console.error("failed to acknowledge reply Mark", error);
      }
    }
  });

  return bot;
}
