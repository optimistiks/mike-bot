import { and, eq } from "drizzle-orm";
import type { Context } from "grammy";

import type { AppDatabase } from "@/lib/db/runtime";
import { messageAuthors, registrationMessages } from "@/lib/db/schema";

export const REGISTRATION_PIN_TEXT =
  "Поставьте реакцию на это сообщение, чтобы участвовать в таблице лидеров";

export const REGISTER_GROUP_ONLY_MESSAGE =
  "Команда /register работает только в группах.";

export const REGISTER_ADMIN_ONLY_MESSAGE =
  "Только администраторы группы могут использовать /register.";

export function isGroupChat(chatType: string): boolean {
  return chatType === "group" || chatType === "supergroup";
}

export function isChatAdminStatus(status: string): boolean {
  return status === "creator" || status === "administrator";
}

export async function recordRegistrationPin(
  db: AppDatabase,
  params: {
    chatId: number;
    messageId: number;
    botUserId: number;
    messageDate: number;
    createdAt?: Date;
  },
): Promise<void> {
  await db
    .insert(messageAuthors)
    .values({
      chatId: params.chatId,
      messageId: params.messageId,
      authorId: params.botUserId,
      authorIsBot: true,
      messageDate: params.messageDate,
    })
    .onConflictDoNothing();

  await db
    .insert(registrationMessages)
    .values({
      chatId: params.chatId,
      messageId: params.messageId,
      createdAt: params.createdAt ?? new Date(),
    })
    .onConflictDoNothing();
}

export async function isRegistrationMessage(
  db: AppDatabase,
  chatId: number,
  messageId: number,
): Promise<boolean> {
  const rows = await db
    .select({ messageId: registrationMessages.messageId })
    .from(registrationMessages)
    .where(
      and(
        eq(registrationMessages.chatId, chatId),
        eq(registrationMessages.messageId, messageId),
      ),
    )
    .limit(1);

  return rows.length > 0;
}

export async function handleRegisterCommand(
  db: AppDatabase,
  ctx: Context,
): Promise<void> {
  const chat = ctx.chat;
  const from = ctx.from;
  if (!chat || !from) {
    return;
  }

  if (!isGroupChat(chat.type)) {
    await ctx.reply(REGISTER_GROUP_ONLY_MESSAGE);
    return;
  }

  const member = await ctx.getChatMember(from.id);
  if (!isChatAdminStatus(member.status)) {
    await ctx.reply(REGISTER_ADMIN_ONLY_MESSAGE);
    return;
  }

  const sent = await ctx.reply(REGISTRATION_PIN_TEXT);
  await recordRegistrationPin(db, {
    chatId: chat.id,
    messageId: sent.message_id,
    botUserId: ctx.me.id,
    messageDate: sent.date,
  });
}
