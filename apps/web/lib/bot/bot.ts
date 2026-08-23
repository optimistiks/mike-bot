import { Bot, Context } from "grammy";

import type { AppDatabase } from "@/lib/db/runtime";

import { handleTelegramUpdate } from "./handle-update";
import { handleReplyMark } from "./reply-marks";
import { handleStatsCommand } from "./stats";

export interface BotDependencies {
  db: AppDatabase;
  token: string;
}

/**
 * Something to say in the Chat once the transaction has committed.
 *
 * The record — the Mark, the Registration — is always stored first, so a
 * Telegram call the bot has no rights for costs the announcement and never the
 * record (ADR-0014). It also keeps network round trips out of the transaction,
 * which would otherwise hold its locks for their duration.
 */
export type AfterCommit = () => Promise<void>;

export function createBot({ db, token }: BotDependencies): Bot {
  const bot = new Bot(token);
  const isRegisterCommand = Context.has.command("register");
  const isStatsCommand = Context.has.command("stats");

  bot.use(async (ctx) => {
    const announcement: { pending: AfterCommit | null } = { pending: null };

    await handleTelegramUpdate(db, ctx.update, async (transactionDb) => {
      // /register is an alias of /stats: both register the caller and reply
      // with the same Mini App deep link.
      if (isRegisterCommand(ctx) || isStatsCommand(ctx)) {
        announcement.pending = await handleStatsCommand(transactionDb, ctx);
        return;
      }

      const acknowledgement = await handleReplyMark(transactionDb, ctx);
      if (!acknowledgement) return;

      announcement.pending = async () => {
        try {
          await ctx.deleteMessage();
        } catch (error) {
          console.error("failed to delete Scoring reply", error);
        }

        await ctx.reply(acknowledgement.text, {
          reply_parameters: { message_id: acknowledgement.replyToMessageId },
        });
      };
    });

    try {
      await announcement.pending?.();
    } catch (error) {
      console.error("failed to answer in the Chat", error);
    }
  });

  // grammY swallows errors once a handler is installed, so rethrow: a failed
  // update must still reach Telegram as a failure, or the retry that would have
  // fixed it never comes. This only adds the context to diagnose it by.
  bot.catch((error) => {
    console.error("failed to handle update", {
      update_id: error.ctx.update.update_id,
      chat_id: error.ctx.chat?.id,
      error: error.error,
    });
    throw error.error;
  });

  return bot;
}
