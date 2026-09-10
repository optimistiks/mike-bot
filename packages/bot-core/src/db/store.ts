import type { SQL } from "drizzle-orm";
import type { Message, User } from "grammy/types";

import { and, desc, eq, inArray, isNotNull, isNull, lt, ne, or, sql } from "drizzle-orm";

import type { MarkType } from "#src/domain/mark.js";

import { CLOSED_TURN_WINDOW } from "#src/constants.js";
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
type MemberRow = typeof members.$inferSelect;

async function claimUpdate(db: BotSession, updateId: number): Promise<boolean> {
  const inserted = await db
    .insert(processedUpdates)
    .values({ updateId })
    .onConflictDoNothing()
    .returning();
  return inserted.length === 1;
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
  return inserted.length === 1;
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "23505";
}

async function findOpenConversation(
  db: BotSession,
  chatId: number,
): Promise<ConversationRow | null> {
  const rows = await db
    .select()
    .from(conversations)
    .where(and(eq(conversations.chatId, chatId), isNull(conversations.closedAt)))
    .limit(1)
    .for("update");
  return rows.at(0) ?? null;
}

async function findUnopenedConversation(
  db: BotSession,
  chatId: number,
): Promise<ConversationRow | null> {
  const rows = await db
    .select()
    .from(conversations)
    .where(and(eq(conversations.chatId, chatId), isNull(conversations.openedAt)))
    .limit(1)
    .for("update");
  return rows.at(0) ?? null;
}

async function findPreviousFinishedConversation(
  db: BotSession,
  chatId: number,
  conversationId: string,
): Promise<ConversationRow | null> {
  const rows = await db
    .select()
    .from(conversations)
    .where(
      and(
        eq(conversations.chatId, chatId),
        ne(conversations.id, conversationId),
        isNotNull(conversations.openedAt),
        isNotNull(conversations.closedAt),
      ),
    )
    .orderBy(desc(conversations.closedAt))
    .limit(1);
  return rows.at(0) ?? null;
}

async function findConversationById(
  db: BotSession,
  conversationId: string,
): Promise<ConversationRow | null> {
  const rows = await db
    .select()
    .from(conversations)
    .where(eq(conversations.id, conversationId))
    .limit(1);
  return rows.at(0) ?? null;
}

async function tryInsertUnopenedConversation(
  db: BotSession,
  chatId: number,
  closedAt: Date,
): Promise<ConversationRow | null> {
  try {
    const inserted = await db
      .insert(conversations)
      .values({ chatId, closedAt, openedAt: null })
      .onConflictDoNothing({
        target: conversations.chatId,
        where: sql`${conversations.openedAt} is null`,
      })
      .returning();
    return inserted.at(0) ?? null;
  } catch (error) {
    if (isUniqueViolation(error)) {
      return null;
    }
    throw error;
  }
}

async function tryOpenConversation(
  db: BotSession,
  conversationId: string,
  openedAt: Date,
): Promise<ConversationRow | null> {
  try {
    const rows = await db
      .update(conversations)
      .set({ closedAt: null, openedAt })
      .where(and(eq(conversations.id, conversationId), isNull(conversations.openedAt)))
      .returning();
    return rows.at(0) ?? null;
  } catch (error) {
    if (isUniqueViolation(error)) {
      return null;
    }
    throw error;
  }
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
    .limit(1);
  return rows.length > 0;
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
  const remaining = await db
    .select({ memberId: conversationParticipants.memberId })
    .from(conversationParticipants)
    .where(eq(conversationParticipants.conversationId, conversationId));
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
    .limit(1);
  return (rows.at(0)?.seq ?? 0) + 1;
}

interface AppendTurnInput {
  conversationId: string;
  memberId: number | null;
  postedAt: Date;
  replyQuote: string | null;
  replyTargetLabel: string | null;
  role: "member" | "assistant";
  speakerLabel: string | null;
  text: string;
}

async function tryInsertTurn(
  db: BotSession,
  input: AppendTurnInput,
  seq: number,
): Promise<boolean> {
  const inserted = await db
    .insert(conversationTurns)
    .values({
      conversationId: input.conversationId,
      memberId: input.memberId,
      postedAt: input.postedAt,
      replyQuote: input.replyQuote,
      replyTargetLabel: input.replyTargetLabel,
      role: input.role,
      seq,
      speakerLabel: input.speakerLabel,
      text: input.text,
    })
    .onConflictDoNothing()
    .returning();
  return inserted.length === 1;
}

async function appendTurn(db: BotSession, input: AppendTurnInput): Promise<number> {
  const seq = await nextTurnSeq(db, input.conversationId);
  if (await tryInsertTurn(db, input, seq)) {
    return seq;
  }
  return appendTurn(db, input);
}

async function latestMemberTurnSeq(
  db: BotSession,
  conversationId: string,
  memberId: number,
): Promise<number | null> {
  const rows = await db
    .select({ seq: conversationTurns.seq })
    .from(conversationTurns)
    .where(
      and(
        eq(conversationTurns.conversationId, conversationId),
        eq(conversationTurns.memberId, memberId),
        eq(conversationTurns.role, "member"),
      ),
    )
    .orderBy(desc(conversationTurns.seq))
    .limit(1);
  return rows.at(0)?.seq ?? null;
}

async function tryBeginCompletionLease(
  db: BotSession,
  conversationId: string,
  memberId: number,
  now: Date,
  ttlMs: number,
): Promise<Date | null> {
  const { completingAt } = conversationParticipants;
  const idleLease = isNull(completingAt);
  const expiredLease = lt(completingAt, new Date(now.getTime() - ttlMs));
  const updated = await db
    .update(conversationParticipants)
    .set({ completingAt: now })
    .where(
      and(
        eq(conversationParticipants.conversationId, conversationId),
        eq(conversationParticipants.memberId, memberId),
        or(idleLease, expiredLease),
      ),
    )
    .returning();
  return updated.at(0)?.completingAt ?? null;
}

async function endCompletionLease(
  db: BotSession,
  conversationId: string,
  memberId: number,
  leaseAt: Date,
): Promise<void> {
  await db
    .update(conversationParticipants)
    .set({ completingAt: null })
    .where(
      and(
        eq(conversationParticipants.conversationId, conversationId),
        eq(conversationParticipants.memberId, memberId),
        eq(conversationParticipants.completingAt, leaseAt),
      ),
    );
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
  const cutoff = turns.at(-keep);
  if (cutoff === undefined) {
    return;
  }
  await deleteTurnsBefore(db, conversationId, cutoff.seq);
}

async function trimIfUnopened(db: BotSession, conversationId: string): Promise<void> {
  const conversation = await findConversationById(db, conversationId);
  if (conversation === null || conversation.openedAt !== null) {
    return;
  }
  await trimOldestTurns(db, conversationId, CLOSED_TURN_WINDOW);
}

async function listNewestTurns(
  db: BotSession,
  conversationId: string,
  count: number,
): Promise<ConversationTurnRow[]> {
  const rows = await db
    .select()
    .from(conversationTurns)
    .where(eq(conversationTurns.conversationId, conversationId))
    .orderBy(desc(conversationTurns.seq))
    .limit(count);
  return rows.toReversed();
}

function copiedTurnValues(
  row: ConversationTurnRow,
  conversationId: string,
  seq: number,
): {
  conversationId: string;
  memberId: number | null;
  postedAt: Date;
  replyQuote: string | null;
  replyTargetLabel: string | null;
  role: string;
  seq: number;
  speakerLabel: string | null;
  text: string;
} {
  return {
    conversationId,
    memberId: row.memberId,
    postedAt: row.postedAt,
    replyQuote: row.replyQuote,
    replyTargetLabel: row.replyTargetLabel,
    role: row.role,
    seq,
    speakerLabel: row.speakerLabel,
    text: row.text,
  };
}

async function replaceTurns(
  db: BotSession,
  conversationId: string,
  prefix: ConversationTurnRow[],
  existing: ConversationTurnRow[],
): Promise<void> {
  await db.delete(conversationTurns).where(eq(conversationTurns.conversationId, conversationId));
  const rows = [...prefix, ...existing].map((row, index) =>
    copiedTurnValues(row, conversationId, index + 1),
  );
  if (rows.length === 0) {
    return;
  }
  await db.insert(conversationTurns).values(rows);
}

async function fillTurnsFromPrevious(
  db: BotSession,
  conversation: ConversationRow,
  keep: number,
): Promise<void> {
  const existing = await listTurns(db, conversation.id);
  if (existing.length >= keep) {
    return;
  }
  const previous = await findPreviousFinishedConversation(db, conversation.chatId, conversation.id);
  if (previous === null) {
    return;
  }
  const prefix = await listNewestTurns(db, previous.id, keep - existing.length);
  if (prefix.length === 0) {
    return;
  }
  await replaceTurns(db, conversation.id, prefix, existing);
}

function listMembersByIds(db: BotSession, ids: number[]): Promise<MemberRow[]> {
  if (ids.length === 0) {
    return Promise.resolve([]);
  }
  return db.select().from(members).where(inArray(members.telegramId, ids));
}

export {
  appendTurn,
  claimUpdate,
  closeConversation,
  endCompletionLease,
  ensureMessage,
  fillTurnsFromPrevious,
  findConversationById,
  findOpenConversation,
  findUnopenedConversation,
  isParticipant,
  joinParticipant,
  latestMemberTurnSeq,
  leaveParticipant,
  listMembersByIds,
  listTurns,
  trimIfUnopened,
  trimOldestTurns,
  tryBeginCompletionLease,
  tryInsertMark,
  tryInsertUnopenedConversation,
  tryOpenConversation,
  upsertMember,
};
