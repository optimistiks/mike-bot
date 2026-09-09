import type { Message, User } from "grammy/types";

import type { ConversationTurn, ReplyMark } from "#src/conversation/types.js";
import type { BotSession } from "#src/db/runtime.js";
import type { conversationTurns } from "#src/db/schema.js";

import { CLOSED_TURN_WINDOW } from "#src/constants.js";
import { speakerLabel } from "#src/conversation/label.js";
import { replyFromMessage } from "#src/conversation/reply.js";
import {
  appendTurn,
  closeConversation,
  findConversation,
  insertConversation,
  isParticipant,
  joinParticipant,
  leaveParticipant,
  reopenConversation,
  trimOldestTurns,
} from "#src/db/store.js";
import { telegramDateToPostedAt } from "#src/telegram/identity.js";
import { isStopMessage, isWakeMessage } from "#src/telegram/text.js";

type ConversationTurnRow = typeof conversationTurns.$inferSelect;
type ChatConversation = NonNullable<Awaited<ReturnType<typeof findConversation>>>;

type PersistedConversation =
  | { kind: "closed" }
  | { kind: "silence" }
  | {
      kind: "turn";
      addresseeLabel: string;
      conversationId: string;
      memberId: number;
      now: Date;
      turnSeq: number;
    };

const SILENCE: PersistedConversation = { kind: "silence" };
const UNKNOWN_REPLY: ReplyMark = { quote: null, targetLabel: "???" };

function optionalReply(row: ConversationTurnRow): ReplyMark | null {
  if (row.replyTargetLabel === null) {
    return null;
  }
  return { quote: row.replyQuote, targetLabel: row.replyTargetLabel };
}

function requiredReply(row: ConversationTurnRow): ReplyMark {
  return optionalReply(row) ?? UNKNOWN_REPLY;
}

function modelTurn(row: ConversationTurnRow): ConversationTurn {
  if (row.role === "assistant") {
    return { postedAt: row.postedAt, reply: requiredReply(row), role: "assistant", text: row.text };
  }
  return {
    label: row.speakerLabel ?? "???",
    memberId: row.memberId,
    postedAt: row.postedAt,
    reply: optionalReply(row),
    role: "member",
    text: row.text,
  };
}

function replyColumns(reply: ReplyMark | null): {
  replyQuote: string | null;
  replyTargetLabel: string | null;
} {
  if (reply === null) {
    return { replyQuote: null, replyTargetLabel: null };
  }
  return { replyQuote: reply.quote, replyTargetLabel: reply.targetLabel };
}

function memberTurnInput(
  conversationId: string,
  actor: User,
  text: string,
  now: Date,
  reply: ReplyMark | null,
): {
  conversationId: string;
  memberId: number;
  postedAt: Date;
  replyQuote: string | null;
  replyTargetLabel: string | null;
  role: "member";
  speakerLabel: string;
  text: string;
} {
  const columns = replyColumns(reply);
  return {
    conversationId,
    memberId: actor.id,
    postedAt: now,
    replyQuote: columns.replyQuote,
    replyTargetLabel: columns.replyTargetLabel,
    role: "member",
    speakerLabel: speakerLabel(actor),
    text,
  };
}

async function persistMemberTurn(
  db: BotSession,
  conversation: ChatConversation,
  actor: User,
  text: string,
  now: Date,
  reply: ReplyMark | null,
): Promise<PersistedConversation> {
  const input = memberTurnInput(conversation.id, actor, text, now, reply);
  const turnSeq = await appendTurn(db, input);
  return {
    addresseeLabel: input.speakerLabel,
    conversationId: conversation.id,
    kind: "turn",
    memberId: actor.id,
    now,
    turnSeq,
  };
}

async function persistBystanderTurn(
  db: BotSession,
  conversation: ChatConversation,
  actor: User,
  text: string,
  now: Date,
  reply: ReplyMark | null,
): Promise<PersistedConversation> {
  await appendTurn(db, memberTurnInput(conversation.id, actor, text, now, reply));
  return SILENCE;
}

async function persistStop(
  db: BotSession,
  conversation: ChatConversation | null,
  actor: User,
  now: Date,
): Promise<PersistedConversation> {
  if (conversation === null || conversation.closedAt !== null) {
    return SILENCE;
  }
  if (!(await isParticipant(db, conversation.id, actor.id))) {
    return SILENCE;
  }
  const remaining = await leaveParticipant(db, conversation.id, actor.id);
  if (remaining === 0) {
    await closeConversation(db, conversation.id, now);
    await trimOldestTurns(db, conversation.id, CLOSED_TURN_WINDOW);
  }
  return { kind: "closed" };
}

async function persistTalk(
  db: BotSession,
  existing: ChatConversation | null,
  actor: User,
  chatId: number,
  text: string,
  now: Date,
  reply: ReplyMark | null,
): Promise<PersistedConversation> {
  const wake = isWakeMessage(text);
  const conversation = existing ?? (await insertConversation(db, chatId, now, wake ? null : now));
  if (wake) {
    if (conversation.closedAt !== null) {
      await reopenConversation(db, conversation.id);
    }
    await joinParticipant(db, conversation.id, actor.id, now);
    return persistMemberTurn(db, conversation, actor, text, now, reply);
  }
  if (conversation.closedAt !== null) {
    const result = await persistBystanderTurn(db, conversation, actor, text, now, reply);
    await trimOldestTurns(db, conversation.id, CLOSED_TURN_WINDOW);
    return result;
  }
  if (await isParticipant(db, conversation.id, actor.id)) {
    return persistMemberTurn(db, conversation, actor, text, now, reply);
  }
  return persistBystanderTurn(db, conversation, actor, text, now, reply);
}

async function persistConversation(
  db: BotSession,
  message: Message,
  botUserId: number | undefined,
): Promise<PersistedConversation> {
  const actor = message.from;
  const { text } = message;
  if (actor === undefined || text === undefined) {
    return SILENCE;
  }
  const now = telegramDateToPostedAt(message.date);
  const conversation = await findConversation(db, message.chat.id);
  const reply = replyFromMessage(message, botUserId);
  if (isStopMessage(text)) {
    return persistStop(db, conversation, actor, now);
  }
  return persistTalk(db, conversation, actor, message.chat.id, text, now, reply);
}

export { modelTurn, persistConversation, type PersistedConversation };
