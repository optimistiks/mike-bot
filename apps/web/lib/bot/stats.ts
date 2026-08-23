import { InlineKeyboard, type Context } from "grammy";

import { addRegistration } from "@/lib/db/registrations";
import type { AppDatabase } from "@/lib/db/runtime";

import type { AfterCommit } from "./bot";
import { isGroupChat } from "./chat";

export const STATS_BUTTON_TEXT = "Открыть таблицы лидеров";
export const STATS_MESSAGE_TEXT =
  "Готово! Откройте таблицы лидеров этой группы:";
export const PRIVATE_STATS_MESSAGE_TEXT = "Выберите группу в приложении:";

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
 */
export async function handleStatsCommand(
  db: AppDatabase,
  ctx: Context,
): Promise<AfterCommit | null> {
  const chat = ctx.chat;
  const from = ctx.from;
  if (!chat || !from) return null;

  if (isGroupChat(chat.type)) {
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

  if (chat.type === "private") {
    const link = miniAppLink(ctx.me.username);

    return async () => {
      await ctx.reply(PRIVATE_STATS_MESSAGE_TEXT, {
        reply_markup: new InlineKeyboard().url(STATS_BUTTON_TEXT, link),
      });
    };
  }

  return null;
}
