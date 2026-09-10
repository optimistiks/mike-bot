import type { Message, User } from "grammy/types";

import type { ConversationTurn, ReplyMark } from "#src/conversation/types.js";
import type { BotSession } from "#src/db/runtime.js";
import type { conversationTurns } from "#src/db/schema.js";

import { replyMark, speakerLabel } from "#src/conversation/label.js";
import { isReplyToBot, replyFromMessage } from "#src/conversation/reply.js";
import { appendTurn, findOrMintConversation, trimOldestTurns } from "#src/db/store.js";
import { telegramDateToPostedAt } from "#src/telegram/identity.js";
import { isWakeMessage } from "#src/telegram/text.js";

type ConversationTurnRow = typeof conversationTurns.$inferSelect;

interface PersistedTurn {
  addresseeLabel: string;
  conversationId: string;
  kind: "turn";
  memberId: number;
  now: Date;
  text: string;
}

type PersistedConversation = { kind: "silence" } | PersistedTurn;

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

function shouldComplete(text: string, message: Message, botUserId: number | undefined): boolean {
  return isWakeMessage(text) || isReplyToBot(message, botUserId);
}

async function persistTalk(
  db: BotSession,
  message: Message,
  actor: User,
  text: string,
  now: Date,
  botUserId: number | undefined,
): Promise<PersistedConversation> {
  const conversation = await findOrMintConversation(db, message.chat.id);
  const input = memberTurnInput(
    conversation.id,
    actor,
    text,
    now,
    replyFromMessage(message, botUserId),
  );
  await appendTurn(db, input);
  await trimOldestTurns(db, conversation.id);
  if (!shouldComplete(text, message, botUserId)) {
    return SILENCE;
  }
  return {
    addresseeLabel: input.speakerLabel,
    conversationId: conversation.id,
    kind: "turn",
    memberId: actor.id,
    now,
    text,
  };
}

async function persistSilentMemberTurn(
  db: BotSession,
  message: Message,
  botUserId: number | undefined,
): Promise<void> {
  const actor = message.from;
  const { text } = message;
  if (actor === undefined || text === undefined) {
    return;
  }
  const now = telegramDateToPostedAt(message.date);
  const conversation = await findOrMintConversation(db, message.chat.id);
  const input = memberTurnInput(
    conversation.id,
    actor,
    text,
    now,
    replyFromMessage(message, botUserId),
  );
  await appendTurn(db, { ...input, memberId: null });
  await trimOldestTurns(db, conversation.id);
}

async function persistSilentAssistantTurn(
  db: BotSession,
  message: Message,
  text: string,
): Promise<void> {
  const actor = message.from;
  const commandText = message.text;
  if (actor === undefined || commandText === undefined) {
    return;
  }
  const now = telegramDateToPostedAt(message.date);
  const conversation = await findOrMintConversation(db, message.chat.id);
  const reply = replyMark(speakerLabel(actor), commandText);
  await appendTurn(db, {
    conversationId: conversation.id,
    memberId: null,
    postedAt: now,
    replyQuote: reply.quote,
    replyTargetLabel: reply.targetLabel,
    role: "assistant",
    speakerLabel: null,
    text,
  });
  await trimOldestTurns(db, conversation.id);
}

function persistConversation(
  db: BotSession,
  message: Message,
  botUserId: number | undefined,
): Promise<PersistedConversation> {
  const actor = message.from;
  const { text } = message;
  if (actor === undefined || text === undefined) {
    return Promise.resolve(SILENCE);
  }
  const now = telegramDateToPostedAt(message.date);
  return persistTalk(db, message, actor, text, now, botUserId);
}

export {
  modelTurn,
  persistConversation,
  persistSilentAssistantTurn,
  persistSilentMemberTurn,
  type PersistedConversation,
};
