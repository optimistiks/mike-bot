import { Bot, Context } from "grammy";

import type { AppDatabase } from "@/lib/db/runtime";

import { handleTelegramUpdate } from "./handle-update";
import { handleReplyMark, type ReplyMarkAcknowledgement } from "./reply-marks";
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
    const replyAcknowledgement: { pending: ReplyMarkAcknowledgement | null } = {
      pending: null,
    };
    await handleTelegramUpdate(db, ctx.update, async (transactionDb) => {
      // /register is an alias of /stats: both register the caller and reply
      // with the same Mini App deep link.
      if (isRegisterCommand(ctx) || isStatsCommand(ctx)) {
        await handleStatsCommand(transactionDb, ctx);
        return;
      }

      replyAcknowledgement.pending = await handleReplyMark(transactionDb, ctx);
    });

    const acknowledgement = replyAcknowledgement.pending;
    if (acknowledgement) {
      // The Mark is already stored, so a failed delete or reply must not undo
      // it — the Chat just misses the announcement.
      try {
        await ctx.deleteMessage();
      } catch (error) {
        console.error("failed to delete Scoring reply", error);
      }

      try {
        await ctx.reply(acknowledgement.text, {
          reply_parameters: { message_id: acknowledgement.replyToMessageId },
        });
      } catch (error) {
        console.error("failed to announce reply Mark", error);
      }
    }
  });

  return bot;
}
