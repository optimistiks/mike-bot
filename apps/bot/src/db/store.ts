import { and, eq } from "drizzle-orm";
import type { Message, User } from "grammy/types";

import type { MarkType } from "../domain/mark";
import type { BotSession } from "../db/runtime";
import {
  conversationTurns,
  conversations,
  marks,
  members,
  messages,
  processedUpdates,
} from "../db/schema";
import { telegramDateToPostedAt } from "../telegram/identity";

export async function claimUpdate(db: BotSession, updateId: number): Promise<boolean> {
  const inserted = await db
    .insert(processedUpdates)
    .values({ updateId })
    .onConflictDoNothing()
    .returning();
  return inserted.length === 1;
}

export async function upsertMember(
  db: BotSession,
  telegramUser: Pick<User, "id" | "username">,
): Promise<void> {
  await db
    .insert(members)
    .values({
      telegramId: telegramUser.id,
      username: telegramUser.username ?? null,
    })
    .onConflictDoUpdate({
      target: members.telegramId,
      set: { username: telegramUser.username ?? null },
    });
}

export async function ensureMessage(db: BotSession, message: Message): Promise<void> {
  const author = message.from;
  if (author === undefined) {
    return;
  }

  await db
    .insert(messages)
    .values({
      chatId: message.chat.id,
      messageId: message.message_id,
      authorId: author.id,
      postedAt: telegramDateToPostedAt(message.date),
    })
    .onConflictDoNothing();
}

export async function tryInsertMark(
  db: BotSession,
  row: {
    chatId: number;
    actorId: number;
    subjectId: number;
    messageId: number;
    type: MarkType;
    createdAt: Date;
  },
): Promise<boolean> {
  const inserted = await db.insert(marks).values(row).onConflictDoNothing().returning();
  return inserted.length === 1;
}

export async function chatHasMarks(db: BotSession, chatId: number): Promise<boolean> {
  const rows = await db
    .select({ actorId: marks.actorId })
    .from(marks)
    .where(eq(marks.chatId, chatId))
    .limit(1);
  return rows.length > 0;
}

export async function findOpenConversation(db: BotSession, memberId: number, chatId: number) {
  const rows = await db
    .select()
    .from(conversations)
    .where(and(eq(conversations.memberId, memberId), eq(conversations.chatId, chatId)));

  return rows.find((row) => row.closedAt === null) ?? null;
}

export async function openConversation(
  db: BotSession,
  memberId: number,
  chatId: number,
  openedAt: Date,
) {
  const inserted = await db
    .insert(conversations)
    .values({ memberId, chatId, openedAt })
    .returning();
  const conversation = inserted[0];
  if (conversation === undefined) {
    throw new Error("failed to open Conversation");
  }
  return conversation;
}

export async function closeConversation(
  db: BotSession,
  conversationId: string,
  closedAt: Date,
): Promise<void> {
  await db.update(conversations).set({ closedAt }).where(eq(conversations.id, conversationId));
}

export async function listTurns(db: BotSession, conversationId: string) {
  return db
    .select()
    .from(conversationTurns)
    .where(eq(conversationTurns.conversationId, conversationId))
    .orderBy(conversationTurns.seq);
}

export async function appendTurn(
  db: BotSession,
  conversationId: string,
  role: "member" | "assistant",
  text: string,
): Promise<void> {
  const existing = await listTurns(db, conversationId);
  const last = existing.at(-1);
  const seq = (last?.seq ?? 0) + 1;
  await db.insert(conversationTurns).values({
    conversationId,
    seq,
    role,
    text,
  });
}
