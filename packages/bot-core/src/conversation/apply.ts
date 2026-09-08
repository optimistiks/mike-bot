import type { Message, User } from "grammy/types";

import type { SpecialToken } from "#src/conversation/tokens.js";
import type { ConversationTurn, ReplyMark } from "#src/conversation/types.js";
import type { BotSession } from "#src/db/runtime.js";

import { CLOSED_TURN_WINDOW, EMPTY_COUNT } from "#src/constants.js";
import { speakerLabel } from "#src/conversation/label.js";
import { replyFromMessage } from "#src/conversation/reply.js";
import { specialToken } from "#src/conversation/tokens.js";
import {
  appendTurn,
  closeConversation,
  findConversation,
  insertConversation,
  isParticipant,
  joinParticipant,
  leaveParticipant,
  listTurns,
  reopenConversation,
  trimOldestTurns,
} from "#src/db/store.js";
import { telegramDateToPostedAt } from "#src/telegram/identity.js";

type ConversationTurnRow = Awaited<ReturnType<typeof listTurns>>[number];
type ChatConversation = NonNullable<Awaited<ReturnType<typeof findConversation>>>;

type PersistedConversation =
  | { kind: "closed" }
  | { kind: "silence" }
  | {
      kind: "turn";
      addresseeLabel: string;
      conversationId: string;
      history: ConversationTurn[];
      memberId: number;
      now: Date;
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
  const reply = optionalReply(row);
  if (reply === null) {
    return UNKNOWN_REPLY;
  }
  return reply;
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

function closedAtForNewTalk(now: Date, token: SpecialToken | null): Date | null {
  if (token === "wake") {
    return null;
  }
  return now;
}

function conversationForTalk(
  db: BotSession,
  existing: ChatConversation | null,
  chatId: number,
  now: Date,
  token: SpecialToken | null,
): Promise<ChatConversation> {
  if (existing !== null) {
    return Promise.resolve(existing);
  }
  return insertConversation(db, chatId, now, closedAtForNewTalk(now, token));
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
  await appendTurn(db, input);
  const history = await listTurns(db, conversation.id);
  return {
    addresseeLabel: input.speakerLabel,
    conversationId: conversation.id,
    history: history.map((row) => modelTurn(row)),
    kind: "turn",
    memberId: actor.id,
    now,
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

async function persistClosedTalk(
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

async function persistWakeTurn(
  db: BotSession,
  conversation: ChatConversation,
  actor: User,
  text: string,
  now: Date,
  reply: ReplyMark | null,
): Promise<PersistedConversation> {
  await joinParticipant(db, conversation.id, actor.id, now);
  return persistMemberTurn(db, conversation, actor, text, now, reply);
}

async function persistWakeOnConversation(
  db: BotSession,
  conversation: ChatConversation,
  actor: User,
  text: string,
  now: Date,
  reply: ReplyMark | null,
): Promise<PersistedConversation> {
  if (conversation.closedAt !== null) {
    await reopenConversation(db, conversation.id);
  }
  return persistWakeTurn(db, conversation, actor, text, now, reply);
}

async function persistParticipantTalk(
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

function persistTalkInConversation(
  db: BotSession,
  conversation: ChatConversation,
  actor: User,
  text: string,
  now: Date,
  token: SpecialToken | null,
  reply: ReplyMark | null,
): Promise<PersistedConversation> {
  if (token === "wake") {
    return persistWakeOnConversation(db, conversation, actor, text, now, reply);
  }
  if (conversation.closedAt !== null) {
    return persistClosedTalk(db, conversation, actor, text, now, reply);
  }
  return persistParticipantTalk(db, conversation, actor, text, now, reply);
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
  const token = specialToken(text);
  const conversation = await conversationForTalk(db, existing, chatId, now, token);
  return persistTalkInConversation(db, conversation, actor, text, now, token, reply);
}

async function leaveAndMaybeClose(
  db: BotSession,
  conversationId: string,
  memberId: number,
  now: Date,
): Promise<PersistedConversation> {
  const remaining = await leaveParticipant(db, conversationId, memberId);
  if (remaining === EMPTY_COUNT) {
    await closeConversation(db, conversationId, now);
    await trimOldestTurns(db, conversationId, CLOSED_TURN_WINDOW);
  }
  return { kind: "closed" };
}

async function persistStopForOpen(
  db: BotSession,
  conversation: ChatConversation,
  actor: User,
  now: Date,
): Promise<PersistedConversation> {
  if (!(await isParticipant(db, conversation.id, actor.id))) {
    return SILENCE;
  }
  return leaveAndMaybeClose(db, conversation.id, actor.id, now);
}

function persistStop(
  db: BotSession,
  conversation: ChatConversation | null,
  actor: User,
  now: Date,
): Promise<PersistedConversation> {
  if (conversation === null || conversation.closedAt !== null) {
    return Promise.resolve(SILENCE);
  }
  return persistStopForOpen(db, conversation, actor, now);
}

function persistStopOrTalk(
  db: BotSession,
  conversation: ChatConversation | null,
  actor: User,
  chatId: number,
  text: string,
  now: Date,
  reply: ReplyMark | null,
): Promise<PersistedConversation> {
  if (specialToken(text) === "stop") {
    return persistStop(db, conversation, actor, now);
  }
  return persistTalk(db, conversation, actor, chatId, text, now, reply);
}

async function persistConversationMessage(
  db: BotSession,
  message: Message,
  actor: User,
  text: string,
  botUserId: number | undefined,
): Promise<PersistedConversation> {
  const now = telegramDateToPostedAt(message.date);
  const conversation = await findConversation(db, message.chat.id);
  return persistStopOrTalk(
    db,
    conversation,
    actor,
    message.chat.id,
    text,
    now,
    replyFromMessage(message, botUserId),
  );
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
  return persistConversationMessage(db, message, actor, text, botUserId);
}

export { persistConversation, type PersistedConversation };
