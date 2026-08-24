import { InlineKeyboard, type Context } from "grammy";

import { addRegistration } from "@/lib/db/registrations";
import type { AppDatabase } from "@/lib/db/runtime";

import type { AfterCommit } from "./bot";

export const STATS_BUTTON_TEXT = "Открыть таблицы лидеров";
export const STATS_MESSAGE_TEXT =
  "Готово! Откройте таблицы лидеров этой группы:";

export function miniAppLink(botUsername: string, chatId?: number): string {
  const base = `https://t.me/${botUsername}`;
  return chatId === undefined
    ? `${base}?startapp`
    : `${base}?startapp=chat_${String(chatId)}`;
}

/**
 * Establish the caller's Registration and describe the reply that opens the
 * Mini App. The reply is returned rather than sent so it happens after the
 * transaction commits: a Registration is a fact about the caller, and a send
 * the bot has no rights for must not roll it back.
 *
 * Only a supergroup call does anything. Registration is authorization to view
 * one Chat, so there is nothing for it to mean outside one — a private caller
 * reaches the Chat selector by launching the Mini App.
 */
export async function handleStatsCommand(
  db: AppDatabase,
  ctx: Context,
): Promise<AfterCommit | null> {
  const chat = ctx.chat;
  const from = ctx.from;
  if (!chat || !from || chat.type !== "supergroup") return null;

  await addRegistration(db, chat.id, from.id);
  const link = miniAppLink(ctx.me.username, chat.id);

  return async () => {
    await ctx.reply(STATS_MESSAGE_TEXT, {
      // Ephemeral reply: only the caller sees it, so the group stays uncluttered.
      receiver_user_id: from.id,
      reply_markup: new InlineKeyboard().url(STATS_BUTTON_TEXT, link),
    });
  };
}
