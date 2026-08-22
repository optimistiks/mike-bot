import { InlineKeyboard, type Context } from "grammy";

import { addRegistration } from "@/lib/db/registrations";
import type { AppDatabase } from "@/lib/db/runtime";

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

export async function handleStatsCommand(
  db: AppDatabase,
  ctx: Context,
): Promise<void> {
  const chat = ctx.chat;
  const from = ctx.from;
  if (!chat || !from) return;

  if (isGroupChat(chat.type)) {
    await addRegistration(db, chat.id, from.id);
    await ctx.reply(STATS_MESSAGE_TEXT, {
      // Ephemeral reply: only the caller sees it, so the group stays uncluttered.
      receiver_user_id: from.id,
      reply_markup: new InlineKeyboard().url(
        STATS_BUTTON_TEXT,
        miniAppLink(ctx.me.username, chat.id),
      ),
    });
    return;
  }

  if (chat.type === "private") {
    await ctx.reply(PRIVATE_STATS_MESSAGE_TEXT, {
      reply_markup: new InlineKeyboard().url(
        STATS_BUTTON_TEXT,
        miniAppLink(ctx.me.username),
      ),
    });
  }
}
