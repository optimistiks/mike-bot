import type { Message, User } from "grammy/types";

import type { SpecialToken } from "#src/conversation/tokens.js";
import type { ConversationTurn } from "#src/conversation/types.js";
import type { BotSession } from "#src/db/runtime.js";

import { CLOSED_TURN_WINDOW, EMPTY_COUNT } from "#src/constants.js";
import { speakerLabel } from "#src/conversation/label.js";
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

function modelTurn(row: ConversationTurnRow): ConversationTurn {
  if (row.role === "assistant") {
    return { postedAt: row.postedAt, role: "assistant", text: row.text };
  }
  return {
    label: row.speakerLabel ?? "???",
    memberId: row.memberId,
    postedAt: row.postedAt,
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

async function persistMemberTurn(
  db: BotSession,
  conversation: ChatConversation,
  actor: User,
  text: string,
  now: Date,
): Promise<PersistedConversation> {
  const label = speakerLabel(actor);
  await appendTurn(db, conversation.id, "member", text, label, actor.id, now);
  const history = await listTurns(db, conversation.id);
  return {
    addresseeLabel: label,
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
): Promise<PersistedConversation> {
  await appendTurn(db, conversation.id, "member", text, speakerLabel(actor), actor.id, now);
  return SILENCE;
}

async function persistClosedTalk(
  db: BotSession,
  conversation: ChatConversation,
  actor: User,
  text: string,
  now: Date,
): Promise<PersistedConversation> {
  const result = await persistBystanderTurn(db, conversation, actor, text, now);
  await trimOldestTurns(db, conversation.id, CLOSED_TURN_WINDOW);
  return result;
}

async function persistWakeTurn(
  db: BotSession,
  conversation: ChatConversation,
  actor: User,
  text: string,
  now: Date,
): Promise<PersistedConversation> {
  await joinParticipant(db, conversation.id, actor.id, now);
  return persistMemberTurn(db, conversation, actor, text, now);
}

async function persistWakeOnConversation(
  db: BotSession,
  conversation: ChatConversation,
  actor: User,
  text: string,
  now: Date,
): Promise<PersistedConversation> {
  if (conversation.closedAt !== null) {
    await reopenConversation(db, conversation.id);
  }
  return persistWakeTurn(db, conversation, actor, text, now);
}

async function persistParticipantTalk(
  db: BotSession,
  conversation: ChatConversation,
  actor: User,
  text: string,
  now: Date,
): Promise<PersistedConversation> {
  if (await isParticipant(db, conversation.id, actor.id)) {
    return persistMemberTurn(db, conversation, actor, text, now);
  }
  return persistBystanderTurn(db, conversation, actor, text, now);
}

function persistTalkInConversation(
  db: BotSession,
  conversation: ChatConversation,
  actor: User,
  text: string,
  now: Date,
  token: SpecialToken | null,
): Promise<PersistedConversation> {
  if (token === "wake") {
    return persistWakeOnConversation(db, conversation, actor, text, now);
  }
  if (conversation.closedAt !== null) {
    return persistClosedTalk(db, conversation, actor, text, now);
  }
  return persistParticipantTalk(db, conversation, actor, text, now);
}

async function persistTalk(
  db: BotSession,
  existing: ChatConversation | null,
  actor: User,
  chatId: number,
  text: string,
  now: Date,
): Promise<PersistedConversation> {
  const token = specialToken(text);
  const conversation = await conversationForTalk(db, existing, chatId, now, token);
  return persistTalkInConversation(db, conversation, actor, text, now, token);
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
): Promise<PersistedConversation> {
  if (specialToken(text) === "stop") {
    return persistStop(db, conversation, actor, now);
  }
  return persistTalk(db, conversation, actor, chatId, text, now);
}

async function persistConversationMessage(
  db: BotSession,
  message: Message,
  actor: User,
  text: string,
): Promise<PersistedConversation> {
  const now = telegramDateToPostedAt(message.date);
  const conversation = await findConversation(db, message.chat.id);
  return persistStopOrTalk(db, conversation, actor, message.chat.id, text, now);
}

function persistConversation(db: BotSession, message: Message): Promise<PersistedConversation> {
  const actor = message.from;
  const { text } = message;
  if (actor === undefined || text === undefined) {
    return Promise.resolve(SILENCE);
  }
  return persistConversationMessage(db, message, actor, text);
}

export { persistConversation, type PersistedConversation };
