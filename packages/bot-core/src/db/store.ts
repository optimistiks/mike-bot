import type { SQL } from "drizzle-orm";
import type { Message, User } from "grammy/types";

import { and, desc, eq, inArray, isNull, lt, or } from "drizzle-orm";

import type { MarkType } from "#src/domain/mark.js";

import { TURN_WINDOW } from "#src/constants.js";
import { telegramDateToPostedAt } from "#src/telegram/identity.js";

import type { BotSession } from "./runtime.js";

import {
  conversationCompletionLeases,
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

async function findConversationByChatId(
  db: BotSession,
  chatId: number,
): Promise<ConversationRow | null> {
  const rows = await db
    .select()
    .from(conversations)
    .where(eq(conversations.chatId, chatId))
    .limit(1)
    .for("update");
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

async function tryInsertConversation(
  db: BotSession,
  chatId: number,
): Promise<ConversationRow | null> {
  try {
    const inserted = await db
      .insert(conversations)
      .values({ chatId })
      .onConflictDoNothing({
        target: conversations.chatId,
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

async function findOrMintConversation(db: BotSession, chatId: number): Promise<ConversationRow> {
  const existing = await findConversationByChatId(db, chatId);
  if (existing !== null) {
    return existing;
  }
  const minted = await tryInsertConversation(db, chatId);
  if (minted !== null) {
    return minted;
  }
  const raced = await findConversationByChatId(db, chatId);
  if (raced !== null) {
    return raced;
  }
  return findOrMintConversation(db, chatId);
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

function leaseWhere(conversationId: string, memberId: number): SQL | undefined {
  return and(
    eq(conversationCompletionLeases.conversationId, conversationId),
    eq(conversationCompletionLeases.memberId, memberId),
  );
}

async function tryBeginCompletionLease(
  db: BotSession,
  conversationId: string,
  memberId: number,
  now: Date,
  ttlMs: number,
): Promise<Date | null> {
  const { completingAt } = conversationCompletionLeases;
  const idleLease = isNull(completingAt);
  const expiredLease = lt(completingAt, new Date(now.getTime() - ttlMs));
  const updated = await db
    .update(conversationCompletionLeases)
    .set({ completingAt: now })
    .where(and(leaseWhere(conversationId, memberId), or(idleLease, expiredLease)))
    .returning();
  const taken = updated.at(0)?.completingAt;
  if (taken !== undefined) {
    return taken;
  }
  try {
    const inserted = await db
      .insert(conversationCompletionLeases)
      .values({ completingAt: now, conversationId, memberId })
      .onConflictDoNothing()
      .returning();
    return inserted.at(0)?.completingAt ?? null;
  } catch (error) {
    if (isUniqueViolation(error)) {
      return null;
    }
    throw error;
  }
}

async function endCompletionLease(
  db: BotSession,
  conversationId: string,
  memberId: number,
  leaseAt: Date,
): Promise<void> {
  await db
    .update(conversationCompletionLeases)
    .set({ completingAt: null })
    .where(
      and(
        leaseWhere(conversationId, memberId),
        eq(conversationCompletionLeases.completingAt, leaseAt),
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

async function trimOldestTurns(db: BotSession, conversationId: string): Promise<void> {
  const turns = await listTurns(db, conversationId);
  if (turns.length <= TURN_WINDOW) {
    return;
  }
  const cutoff = turns.at(-TURN_WINDOW);
  if (cutoff === undefined) {
    return;
  }
  await deleteTurnsBefore(db, conversationId, cutoff.seq);
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
  endCompletionLease,
  ensureMessage,
  findConversationById,
  findOrMintConversation,
  listMembersByIds,
  listTurns,
  trimOldestTurns,
  tryBeginCompletionLease,
  tryInsertMark,
  upsertMember,
};
