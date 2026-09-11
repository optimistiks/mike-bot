import type { SQL } from "drizzle-orm";
import type { Message, User } from "grammy/types";

import { and, desc, eq, inArray, isNull, lt, or } from "drizzle-orm";

import type { MarkType } from "#src/domain/mark.js";

import { SENTRY_CONVERSATION_GAP_MS, TURN_WINDOW } from "#src/constants.js";
import { telegramDateToPostedAt } from "#src/telegram/identity.js";

import type { BotSession } from "./runtime.js";

import {
  chatCompletionLeases,
  chatTurns,
  chats,
  marks,
  members,
  messages,
  processedUpdates,
} from "./schema.js";

type ChatRow = typeof chats.$inferSelect;
type ChatTurnRow = typeof chatTurns.$inferSelect;
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

async function findChatByChatId(db: BotSession, chatId: number): Promise<ChatRow | null> {
  const rows = await db.select().from(chats).where(eq(chats.chatId, chatId)).limit(1).for("update");
  return rows.at(0) ?? null;
}

async function tryInsertChat(db: BotSession, chatId: number): Promise<ChatRow | null> {
  try {
    const inserted = await db.insert(chats).values({ chatId }).onConflictDoNothing().returning();
    return inserted.at(0) ?? null;
  } catch (error) {
    if (isUniqueViolation(error)) {
      return null;
    }
    throw error;
  }
}

async function findOrMintChat(db: BotSession, chatId: number): Promise<ChatRow> {
  const existing = await findChatByChatId(db, chatId);
  if (existing !== null) {
    return existing;
  }
  const minted = await tryInsertChat(db, chatId);
  if (minted !== null) {
    return minted;
  }
  const raced = await findChatByChatId(db, chatId);
  if (raced !== null) {
    return raced;
  }
  return findOrMintChat(db, chatId);
}

function listTurns(db: BotSession, chatId: number): Promise<ChatTurnRow[]> {
  return db.select().from(chatTurns).where(eq(chatTurns.chatId, chatId)).orderBy(chatTurns.seq);
}

async function nextTurnSeq(db: BotSession, chatId: number): Promise<number> {
  const rows = await db
    .select({ seq: chatTurns.seq })
    .from(chatTurns)
    .where(eq(chatTurns.chatId, chatId))
    .orderBy(desc(chatTurns.seq))
    .limit(1);
  return (rows.at(0)?.seq ?? 0) + 1;
}

interface AppendTurnInput {
  chatId: number;
  memberId: number | null;
  messageId: number;
  postedAt: Date;
  replyPostedAt: Date | null;
  replyQuote: string | null;
  replyTargetLabel: string | null;
  replyToMessageId: number | null;
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
    .insert(chatTurns)
    .values({
      chatId: input.chatId,
      memberId: input.memberId,
      messageId: input.messageId,
      postedAt: input.postedAt,
      replyPostedAt: input.replyPostedAt,
      replyQuote: input.replyQuote,
      replyTargetLabel: input.replyTargetLabel,
      replyToMessageId: input.replyToMessageId,
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
  const seq = await nextTurnSeq(db, input.chatId);
  if (await tryInsertTurn(db, input, seq)) {
    return seq;
  }
  return appendTurn(db, input);
}

function leaseWhere(chatId: number, memberId: number): SQL | undefined {
  return and(eq(chatCompletionLeases.chatId, chatId), eq(chatCompletionLeases.memberId, memberId));
}

async function tryBeginCompletionLease(
  db: BotSession,
  chatId: number,
  memberId: number,
  now: Date,
  ttlMs: number,
): Promise<Date | null> {
  const { completingAt } = chatCompletionLeases;
  const idleLease = isNull(completingAt);
  const expiredLease = lt(completingAt, new Date(now.getTime() - ttlMs));
  const updated = await db
    .update(chatCompletionLeases)
    .set({ completingAt: now })
    .where(and(leaseWhere(chatId, memberId), or(idleLease, expiredLease)))
    .returning();
  const taken = updated.at(0)?.completingAt;
  if (taken !== undefined) {
    return taken;
  }
  try {
    const inserted = await db
      .insert(chatCompletionLeases)
      .values({ chatId, completingAt: now, memberId })
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
  chatId: number,
  memberId: number,
  leaseAt: Date,
): Promise<void> {
  await db
    .update(chatCompletionLeases)
    .set({ completingAt: null })
    .where(and(leaseWhere(chatId, memberId), eq(chatCompletionLeases.completingAt, leaseAt)));
}

async function deleteTurnsBefore(db: BotSession, chatId: number, seq: number): Promise<void> {
  await db.delete(chatTurns).where(and(eq(chatTurns.chatId, chatId), lt(chatTurns.seq, seq)));
}

async function trimOldestTurns(db: BotSession, chatId: number): Promise<void> {
  const turns = await listTurns(db, chatId);
  if (turns.length <= TURN_WINDOW) {
    return;
  }
  const cutoff = turns.at(-TURN_WINDOW);
  if (cutoff === undefined) {
    return;
  }
  await deleteTurnsBefore(db, chatId, cutoff.seq);
}

function listMembersByIds(db: BotSession, ids: number[]): Promise<MemberRow[]> {
  if (ids.length === 0) {
    return Promise.resolve([]);
  }
  return db.select().from(members).where(inArray(members.telegramId, ids));
}

function isPastSentryGap(lastLlmRepliedAt: Date | null, triggerPostedAt: Date): boolean {
  if (lastLlmRepliedAt === null) {
    return true;
  }
  return triggerPostedAt.getTime() - lastLlmRepliedAt.getTime() > SENTRY_CONVERSATION_GAP_MS;
}

function canReuseSentryConversation(chat: ChatRow, triggerPostedAt: Date): boolean {
  if (chat.sentryConversationId === null) {
    return false;
  }
  if (!isPastSentryGap(chat.lastLlmRepliedAt, triggerPostedAt)) {
    return true;
  }
  if (chat.lastLlmRepliedAt === null) {
    return true;
  }
  return (
    chat.sentryConversationBoundAt !== null &&
    chat.sentryConversationBoundAt.getTime() > chat.lastLlmRepliedAt.getTime()
  );
}

async function mintSentryConversation(
  db: BotSession,
  chatId: number,
  triggerPostedAt: Date,
): Promise<string> {
  const sentryConversationId = crypto.randomUUID();
  await db
    .update(chats)
    .set({ sentryConversationBoundAt: triggerPostedAt, sentryConversationId })
    .where(eq(chats.chatId, chatId));
  return sentryConversationId;
}

async function bindSentryConversation(
  db: BotSession,
  chatId: number,
  triggerPostedAt: Date,
): Promise<string> {
  const chat = await findOrMintChat(db, chatId);
  const existing = chat.sentryConversationId;
  if (existing !== null && canReuseSentryConversation(chat, triggerPostedAt)) {
    return existing;
  }
  return mintSentryConversation(db, chatId, triggerPostedAt);
}

async function stampLastLlmRepliedAt(
  db: BotSession,
  chatId: number,
  postedAt: Date,
): Promise<void> {
  await db.update(chats).set({ lastLlmRepliedAt: postedAt }).where(eq(chats.chatId, chatId));
}

export {
  appendTurn,
  bindSentryConversation,
  claimUpdate,
  endCompletionLease,
  ensureMessage,
  findOrMintChat,
  listMembersByIds,
  listTurns,
  stampLastLlmRepliedAt,
  trimOldestTurns,
  tryBeginCompletionLease,
  tryInsertMark,
  upsertMember,
};
