import type { SQL } from "drizzle-orm";
import type { Message, User } from "grammy/types";

import { and, desc, eq, inArray, lt } from "drizzle-orm";

import type { MarkType } from "#src/domain/mark.js";

import { CLOSED_TURN_WINDOW, EMPTY_COUNT, FIRST_INDEX, SINGLE_COUNT } from "#src/constants.js";
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
type MemberRow = typeof members.$inferSelect;

async function claimUpdate(db: BotSession, updateId: number): Promise<boolean> {
  const inserted = await db
    .insert(processedUpdates)
    .values({ updateId })
    .onConflictDoNothing()
    .returning();
  return inserted.length === SINGLE_COUNT;
}

function optionalText(value: string | undefined): string | null {
  return value ?? null;
}

function memberFields(telegramUser: Pick<User, "id" | "username" | "first_name" | "last_name">): {
  firstName: string;
  lastName: string | null;
  telegramId: number;
  username: string | null;
} {
  return {
    firstName: telegramUser.first_name,
    lastName: optionalText(telegramUser.last_name),
    telegramId: telegramUser.id,
    username: optionalText(telegramUser.username),
  };
}

async function upsertMember(
  db: BotSession,
  telegramUser: Pick<User, "id" | "username" | "first_name" | "last_name">,
): Promise<void> {
  const fields = memberFields(telegramUser);
  await db
    .insert(members)
    .values(fields)
    .onConflictDoUpdate({
      set: {
        firstName: fields.firstName,
        lastName: fields.lastName,
        username: fields.username,
      },
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

async function findConversation(db: BotSession, chatId: number): Promise<ConversationRow | null> {
  const rows = await db
    .select()
    .from(conversations)
    .where(eq(conversations.chatId, chatId))
    .limit(SINGLE_COUNT)
    .for("update");

  return rows.at(FIRST_INDEX) ?? null;
}

async function findConversationById(
  db: BotSession,
  conversationId: string,
): Promise<ConversationRow | null> {
  const rows = await db
    .select()
    .from(conversations)
    .where(eq(conversations.id, conversationId))
    .limit(SINGLE_COUNT);
  return rows.at(FIRST_INDEX) ?? null;
}

async function findOpenConversation(
  db: BotSession,
  chatId: number,
): Promise<ConversationRow | null> {
  const conversation = await findConversation(db, chatId);
  if (conversation === null || conversation.closedAt !== null) {
    return null;
  }
  return conversation;
}

async function tryInsertConversation(
  db: BotSession,
  chatId: number,
  openedAt: Date,
  closedAt: Date | null,
): Promise<ConversationRow | null> {
  const inserted = await db
    .insert(conversations)
    .values({ chatId, closedAt, openedAt })
    .onConflictDoNothing({ target: conversations.chatId })
    .returning();
  const [conversation] = inserted;
  return conversation ?? null;
}

async function insertConversation(
  db: BotSession,
  chatId: number,
  openedAt: Date,
  closedAt: Date | null,
): Promise<ConversationRow> {
  const inserted = await tryInsertConversation(db, chatId, openedAt, closedAt);
  if (inserted !== null) {
    return inserted;
  }
  const existing = await findConversation(db, chatId);
  if (existing !== null) {
    return existing;
  }
  return insertConversation(db, chatId, openedAt, closedAt);
}

async function reopenConversation(db: BotSession, conversationId: string): Promise<void> {
  await db
    .update(conversations)
    .set({ closedAt: null })
    .where(eq(conversations.id, conversationId));
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
  const rows = await db
    .select({ seq: conversationTurns.seq })
    .from(conversationTurns)
    .where(eq(conversationTurns.conversationId, conversationId))
    .orderBy(desc(conversationTurns.seq))
    .limit(SINGLE_COUNT);
  return (rows.at(FIRST_INDEX)?.seq ?? EMPTY_COUNT) + SINGLE_COUNT;
}

async function tryInsertTurn(
  db: BotSession,
  conversationId: string,
  role: "member" | "assistant",
  text: string,
  speakerLabel: string | null,
  memberId: number | null,
  postedAt: Date,
  seq: number,
): Promise<boolean> {
  const inserted = await db
    .insert(conversationTurns)
    .values({
      conversationId,
      memberId,
      postedAt,
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
  memberId: number | null,
  postedAt: Date,
): Promise<void> {
  const seq = await nextTurnSeq(db, conversationId);
  if (await tryInsertTurn(db, conversationId, role, text, speakerLabel, memberId, postedAt, seq)) {
    return;
  }
  await appendTurn(db, conversationId, role, text, speakerLabel, memberId, postedAt);
}

async function deleteTurnsBefore(
  db: BotSession,
  conversationId: string,
  seq: number,
): Promise<void> {
  await db
    .delete(conversationTurns)
    .where(
      and(eq(conversationTurns.conversationId, conversationId), lt(conversationTurns.seq, seq)),
    );
}

async function trimOldestTurns(
  db: BotSession,
  conversationId: string,
  keep: number,
): Promise<void> {
  const turns = await listTurns(db, conversationId);
  if (turns.length <= keep) {
    return;
  }
  const cutoff = turns.at(turns.length - keep);
  if (cutoff === undefined) {
    return;
  }
  await deleteTurnsBefore(db, conversationId, cutoff.seq);
}

async function trimIfClosed(db: BotSession, conversationId: string): Promise<void> {
  const conversation = await findConversationById(db, conversationId);
  if (conversation === null || conversation.closedAt === null) {
    return;
  }
  await trimOldestTurns(db, conversationId, CLOSED_TURN_WINDOW);
}

function listMembersByIds(db: BotSession, ids: number[]): Promise<MemberRow[]> {
  if (ids.length === EMPTY_COUNT) {
    return Promise.resolve([]);
  }
  return db.select().from(members).where(inArray(members.telegramId, ids));
}

export {
  appendTurn,
  chatHasMarks,
  claimUpdate,
  closeConversation,
  ensureMessage,
  findConversation,
  findOpenConversation,
  insertConversation,
  isParticipant,
  joinParticipant,
  leaveParticipant,
  listMembersByIds,
  listParticipants,
  listTurns,
  reopenConversation,
  trimIfClosed,
  trimOldestTurns,
  tryInsertMark,
  upsertMember,
};
