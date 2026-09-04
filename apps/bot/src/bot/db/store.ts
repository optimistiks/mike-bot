import type { Message, User } from "grammy/types";

import { and, eq } from "drizzle-orm";

import type { MarkType } from "#src/bot/domain/mark.js";

import { EMPTY_COUNT, LAST_FROM_END, SINGLE_COUNT } from "#src/bot/constants.js";
import { telegramDateToPostedAt } from "#src/bot/telegram/identity.js";

import type { BotSession } from "./runtime.js";

import {
  conversationTurns,
  conversations,
  marks,
  members,
  messages,
  processedUpdates,
} from "./schema.js";

type ConversationRow = typeof conversations.$inferSelect;
type ConversationTurnRow = typeof conversationTurns.$inferSelect;

async function claimUpdate(db: BotSession, updateId: number): Promise<boolean> {
  const inserted = await db
    .insert(processedUpdates)
    .values({ updateId })
    .onConflictDoNothing()
    .returning();
  return inserted.length === SINGLE_COUNT;
}

async function upsertMember(
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
      set: { username: telegramUser.username ?? null },
      target: members.telegramId,
    });
}

async function ensureMessage(db: BotSession, message: Message): Promise<void> {
  const author = message.from;
  if (author === undefined) {
    return;
  }

  await db
    .insert(messages)
    .values({
      authorId: author.id,
      chatId: message.chat.id,
      messageId: message.message_id,
      postedAt: telegramDateToPostedAt(message.date),
    })
    .onConflictDoNothing();
}

async function tryInsertMark(
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
  return inserted.length === SINGLE_COUNT;
}

async function chatHasMarks(db: BotSession, chatId: number): Promise<boolean> {
  const rows = await db
    .select({ actorId: marks.actorId })
    .from(marks)
    .where(eq(marks.chatId, chatId))
    .limit(SINGLE_COUNT);
  return rows.length > EMPTY_COUNT;
}

async function findOpenConversation(
  db: BotSession,
  memberId: number,
  chatId: number,
): Promise<ConversationRow | null> {
  const rows = await db
    .select()
    .from(conversations)
    .where(and(eq(conversations.memberId, memberId), eq(conversations.chatId, chatId)));

  return rows.find((row) => row.closedAt === null) ?? null;
}

async function openConversation(
  db: BotSession,
  memberId: number,
  chatId: number,
  openedAt: Date,
): Promise<ConversationRow> {
  const inserted = await db
    .insert(conversations)
    .values({ chatId, memberId, openedAt })
    .returning();
  const [conversation] = inserted;
  if (conversation === undefined) {
    throw new Error("failed to open Conversation");
  }
  return conversation;
}

async function closeConversation(
  db: BotSession,
  conversationId: string,
  closedAt: Date,
): Promise<void> {
  await db.update(conversations).set({ closedAt }).where(eq(conversations.id, conversationId));
}

function listTurns(db: BotSession, conversationId: string): Promise<ConversationTurnRow[]> {
  return db
    .select()
    .from(conversationTurns)
    .where(eq(conversationTurns.conversationId, conversationId))
    .orderBy(conversationTurns.seq);
}

async function appendTurn(
  db: BotSession,
  conversationId: string,
  role: "member" | "assistant",
  text: string,
): Promise<void> {
  const existing = await listTurns(db, conversationId);
  const last = existing.at(LAST_FROM_END);
  const seq = (last?.seq ?? EMPTY_COUNT) + SINGLE_COUNT;
  await db.insert(conversationTurns).values({
    conversationId,
    role,
    seq,
    text,
  });
}

export {
  appendTurn,
  chatHasMarks,
  claimUpdate,
  closeConversation,
  ensureMessage,
  findOpenConversation,
  listTurns,
  openConversation,
  tryInsertMark,
  upsertMember,
};
