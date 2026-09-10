import type { Message, User } from "grammy/types";

import type { ConversationTurn, ReplyMark } from "#src/conversation/types.js";
import type { BotSession } from "#src/db/runtime.js";
import type { conversationTurns, conversations } from "#src/db/schema.js";

import { CLOSED_TURN_WINDOW } from "#src/constants.js";
import { replyMark, speakerLabel } from "#src/conversation/label.js";
import { replyFromMessage } from "#src/conversation/reply.js";
import {
  appendTurn,
  closeConversation,
  fillTurnsFromPrevious,
  findOpenConversation,
  findUnopenedConversation,
  isParticipant,
  joinParticipant,
  latestMemberTurnSeq,
  leaveParticipant,
  trimIfUnopened,
  trimOldestTurns,
  tryInsertUnopenedConversation,
  tryOpenConversation,
} from "#src/db/store.js";
import { telegramDateToPostedAt } from "#src/telegram/identity.js";
import { isStopMessage, isWakeMessage } from "#src/telegram/text.js";

type ConversationTurnRow = typeof conversationTurns.$inferSelect;
type ChatConversation = typeof conversations.$inferSelect;

interface PersistedTurn {
  addresseeLabel: string;
  conversationId: string;
  kind: "turn";
  memberId: number;
  now: Date;
  turnSeq: number;
}

type PersistedConversation =
  | { kind: "closed" }
  | { kind: "left" }
  | { kind: "silence" }
  | PersistedTurn;

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
): Promise<PersistedTurn> {
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
    return { kind: "closed" };
  }
  return { kind: "left" };
}

async function findOrMintWriteTarget(
  db: BotSession,
  chatId: number,
  now: Date,
): Promise<ChatConversation> {
  const open = await findOpenConversation(db, chatId);
  if (open !== null) {
    return open;
  }
  const unopened = await findUnopenedConversation(db, chatId);
  if (unopened !== null) {
    return unopened;
  }
  const minted = await tryInsertUnopenedConversation(db, chatId, now);
  if (minted !== null) {
    return minted;
  }
  const racedUnopened = await findUnopenedConversation(db, chatId);
  if (racedUnopened !== null) {
    return racedUnopened;
  }
  const racedOpen = await findOpenConversation(db, chatId);
  if (racedOpen !== null) {
    return racedOpen;
  }
  return findOrMintWriteTarget(db, chatId, now);
}

async function ensureOpen(
  db: BotSession,
  conversation: ChatConversation,
  now: Date,
): Promise<ChatConversation> {
  if (conversation.closedAt === null) {
    return conversation;
  }
  const opened = await tryOpenConversation(db, conversation.id, now);
  if (opened !== null) {
    await fillTurnsFromPrevious(db, opened, CLOSED_TURN_WINDOW);
    return opened;
  }
  const existingOpen = await findOpenConversation(db, conversation.chatId);
  if (existingOpen !== null) {
    return existingOpen;
  }
  return conversation;
}

async function persistWake(
  db: BotSession,
  conversation: ChatConversation,
  actor: User,
  text: string,
  now: Date,
  reply: ReplyMark | null,
): Promise<PersistedTurn> {
  const persisted = await persistMemberTurn(db, conversation, actor, text, now, reply);
  const opened = await ensureOpen(db, conversation, now);
  await joinParticipant(db, opened.id, actor.id, now);
  const turnSeq = (await latestMemberTurnSeq(db, opened.id, actor.id)) ?? persisted.turnSeq;
  return { ...persisted, conversationId: opened.id, turnSeq };
}

async function persistIdleTurn(
  db: BotSession,
  conversation: ChatConversation,
  actor: User,
  text: string,
  now: Date,
  reply: ReplyMark | null,
): Promise<PersistedConversation> {
  const result = await persistBystanderTurn(db, conversation, actor, text, now, reply);
  await trimOldestTurns(db, conversation.id, CLOSED_TURN_WINDOW);
  return result;
}

async function persistOpenTalk(
  db: BotSession,
  conversation: ChatConversation,
  actor: User,
  text: string,
  now: Date,
  reply: ReplyMark | null,
): Promise<PersistedConversation> {
  if (await isParticipant(db, conversation.id, actor.id)) {
    return persistMemberTurn(db, conversation, actor, text, now, reply);
  }
  return persistBystanderTurn(db, conversation, actor, text, now, reply);
}

async function persistTalk(
  db: BotSession,
  actor: User,
  chatId: number,
  text: string,
  now: Date,
  reply: ReplyMark | null,
): Promise<PersistedConversation> {
  const conversation = await findOrMintWriteTarget(db, chatId, now);
  if (isWakeMessage(text)) {
    return persistWake(db, conversation, actor, text, now, reply);
  }
  if (conversation.openedAt === null) {
    return persistIdleTurn(db, conversation, actor, text, now, reply);
  }
  return persistOpenTalk(db, conversation, actor, text, now, reply);
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
  const conversation = await findOrMintWriteTarget(db, message.chat.id, now);
  const input = memberTurnInput(
    conversation.id,
    actor,
    text,
    now,
    replyFromMessage(message, botUserId),
  );
  await appendTurn(db, { ...input, memberId: null });
  await trimIfUnopened(db, conversation.id);
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
  const conversation = await findOrMintWriteTarget(db, message.chat.id, now);
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
  await trimIfUnopened(db, conversation.id);
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
  const reply = replyFromMessage(message, botUserId);
  if (isStopMessage(text)) {
    return persistStop(db, await findOpenConversation(db, message.chat.id), actor, now);
  }
  return persistTalk(db, actor, message.chat.id, text, now, reply);
}

export {
  modelTurn,
  persistConversation,
  persistSilentAssistantTurn,
  persistSilentMemberTurn,
  type PersistedConversation,
};
