import { Bot, InlineKeyboard, type Context } from "grammy";

import type { AppDatabase } from "@/lib/db/runtime";

import { handleTelegramUpdate } from "./handle-update";
import type { Announcement } from "./read-update";

export interface BotDependencies {
  db: AppDatabase;
  token: string;
}

/**
 * Say the one thing this update owes the Chat.
 *
 * Always after the transaction has committed, so a Telegram call the bot has no
 * rights for costs the announcement and never the record (ADR-0014). It also
 * keeps network round trips out of the transaction, which would otherwise hold
 * its locks for their duration.
 */
async function announce(
  ctx: Context,
  announcement: Announcement,
): Promise<void> {
  switch (announcement.kind) {
    case "stats":
      await ctx.reply(announcement.text, {
        // Ephemeral reply: only the caller sees it, so the group stays uncluttered.
        receiver_user_id: announcement.receiverUserId,
        reply_markup: new InlineKeyboard().url(
          announcement.buttonText,
          announcement.url,
        ),
      });

      return;

    case "ephemeral":
      await ctx.reply(announcement.text, {
        receiver_user_id: announcement.receiverUserId,
      });

      return;

    case "scoring-reply":
      try {
        await ctx.api.deleteMessage(
          announcement.chatId,
          announcement.deleteMessageId,
        );
      } catch (error) {
        console.error("failed to delete Scoring reply", error);
      }

      await ctx.reply(announcement.text, {
        reply_parameters: { message_id: announcement.replyToMessageId },
      });

      return;
  }
}

export function createBot({ db, token }: BotDependencies): Bot {
  const bot = new Bot(token);

  bot.use(async (ctx) => {
    const { announcement } = await handleTelegramUpdate(
      db,
      ctx.update,
      ctx.me.username,
    );

    if (!announcement) return;

    try {
      await announce(ctx, announcement);
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
