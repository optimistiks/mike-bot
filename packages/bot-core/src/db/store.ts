import type { SQL } from "drizzle-orm";
import type { Message, User } from "grammy/types";

import { and, eq, isNull } from "drizzle-orm";

import type { MarkType } from "#src/domain/mark.js";

import { EMPTY_COUNT, FIRST_INDEX, LAST_FROM_END, SINGLE_COUNT } from "#src/constants.js";
import { telegramDateToPostedAt } from "#src/telegram/identity.js";

import type { BotSession } from "./runtime.js";

import {
  conversationParticipants,
  conversationTurns,
  conversations,
  marks,
  members,
  messages,
  processedUpdates,
} from "./schema.js";

type ConversationRow = typeof conversations.$inferSelect;
type ConversationTurnRow = typeof conversationTurns.$inferSelect;
type ConversationParticipantRow = typeof conversationParticipants.$inferSelect;

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
  chatId: number,
): Promise<ConversationRow | null> {
  const rows = await db
    .select()
    .from(conversations)
    .where(and(eq(conversations.chatId, chatId), isNull(conversations.closedAt)))
    .limit(SINGLE_COUNT);

  return rows.at(FIRST_INDEX) ?? null;
}

async function tryInsertConversation(
  db: BotSession,
  chatId: number,
  openedAt: Date,
): Promise<ConversationRow | null> {
  const inserted = await db
    .insert(conversations)
    .values({ chatId, openedAt })
    .onConflictDoNothing()
    .returning();
  const [conversation] = inserted;
  return conversation ?? null;
}

async function openConversation(
  db: BotSession,
  chatId: number,
  openedAt: Date,
): Promise<ConversationRow> {
  const inserted = await tryInsertConversation(db, chatId, openedAt);
  if (inserted !== null) {
    return inserted;
  }
  const existing = await findOpenConversation(db, chatId);
  if (existing !== null) {
    return existing;
  }
  return openConversation(db, chatId, openedAt);
}

function participantWhere(conversationId: string, memberId: number): SQL | undefined {
  return and(
    eq(conversationParticipants.conversationId, conversationId),
    eq(conversationParticipants.memberId, memberId),
  );
}

async function isParticipant(
  db: BotSession,
  conversationId: string,
  memberId: number,
): Promise<boolean> {
  const rows = await db
    .select({ memberId: conversationParticipants.memberId })
    .from(conversationParticipants)
    .where(participantWhere(conversationId, memberId))
    .limit(SINGLE_COUNT);
  return rows.length > EMPTY_COUNT;
}

function listParticipants(
  db: BotSession,
  conversationId: string,
): Promise<ConversationParticipantRow[]> {
  return db
    .select()
    .from(conversationParticipants)
    .where(eq(conversationParticipants.conversationId, conversationId));
}

async function joinParticipant(
  db: BotSession,
  conversationId: string,
  memberId: number,
  joinedAt: Date,
): Promise<void> {
  await db
    .insert(conversationParticipants)
    .values({ conversationId, joinedAt, memberId })
    .onConflictDoNothing();
}

async function leaveParticipant(
  db: BotSession,
  conversationId: string,
  memberId: number,
): Promise<number> {
  await db.delete(conversationParticipants).where(participantWhere(conversationId, memberId));
  const remaining = await listParticipants(db, conversationId);
  return remaining.length;
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

async function nextTurnSeq(db: BotSession, conversationId: string): Promise<number> {
  const existing = await listTurns(db, conversationId);
  const last = existing.at(LAST_FROM_END);
  return (last?.seq ?? EMPTY_COUNT) + SINGLE_COUNT;
}

async function tryInsertTurn(
  db: BotSession,
  conversationId: string,
  role: "member" | "assistant",
  text: string,
  speakerLabel: string | null,
  seq: number,
): Promise<boolean> {
  const inserted = await db
    .insert(conversationTurns)
    .values({
      conversationId,
      role,
      seq,
      speakerLabel,
      text,
    })
    .onConflictDoNothing()
    .returning();
  return inserted.length === SINGLE_COUNT;
}

async function appendTurn(
  db: BotSession,
  conversationId: string,
  role: "member" | "assistant",
  text: string,
  speakerLabel: string | null,
): Promise<void> {
  const seq = await nextTurnSeq(db, conversationId);
  if (await tryInsertTurn(db, conversationId, role, text, speakerLabel, seq)) {
    return;
  }
  await appendTurn(db, conversationId, role, text, speakerLabel);
}

export {
  appendTurn,
  chatHasMarks,
  claimUpdate,
  closeConversation,
  ensureMessage,
  findOpenConversation,
  isParticipant,
  joinParticipant,
  leaveParticipant,
  listParticipants,
  listTurns,
  openConversation,
  tryInsertMark,
  upsertMember,
};
