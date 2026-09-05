import type { Message, User } from "grammy/types";

import type { ConversationTurn } from "#src/conversation/types.js";
import type { BotSession } from "#src/db/runtime.js";

import { EMPTY_COUNT } from "#src/constants.js";
import { speakerLabel } from "#src/conversation/label.js";
import { specialToken } from "#src/conversation/tokens.js";
import {
  appendTurn,
  closeConversation,
  findOpenConversation,
  isParticipant,
  joinParticipant,
  leaveParticipant,
  listTurns,
  openConversation,
} from "#src/db/store.js";
import { telegramDateToPostedAt } from "#src/telegram/identity.js";

type ConversationTurnRow = Awaited<ReturnType<typeof listTurns>>[number];
type OpenConversation = NonNullable<Awaited<ReturnType<typeof findOpenConversation>>>;

type PersistedConversation =
  | { kind: "closed" }
  | { kind: "silence" }
  | {
      kind: "turn";
      addresseeLabel: string;
      conversationId: string;
      history: ConversationTurn[];
      memberId: number;
    };

const SILENCE: PersistedConversation = { kind: "silence" };

function modelTurn(row: ConversationTurnRow): ConversationTurn {
  if (row.role === "assistant") {
    return { role: "assistant", text: row.text };
  }
  return { label: row.speakerLabel ?? "???", role: "member", text: row.text };
}

function conversationFor(
  db: BotSession,
  open: Awaited<ReturnType<typeof findOpenConversation>>,
  chatId: number,
  now: Date,
): Promise<OpenConversation> {
  if (open !== null) {
    return Promise.resolve(open);
  }
  return openConversation(db, chatId, now);
}

async function persistMemberTurn(
  db: BotSession,
  conversation: OpenConversation,
  actor: User,
  text: string,
): Promise<PersistedConversation> {
  const label = speakerLabel(actor);
  await appendTurn(db, conversation.id, "member", text, label);
  const history = await listTurns(db, conversation.id);
  return {
    addresseeLabel: label,
    conversationId: conversation.id,
    history: history.map((row) => modelTurn(row)),
    kind: "turn",
    memberId: actor.id,
  };
}

async function persistBystanderTurn(
  db: BotSession,
  conversation: OpenConversation,
  actor: User,
  text: string,
): Promise<PersistedConversation> {
  await appendTurn(db, conversation.id, "member", text, speakerLabel(actor));
  return SILENCE;
}

async function persistWakeTurn(
  db: BotSession,
  conversation: OpenConversation,
  actor: User,
  text: string,
  now: Date,
): Promise<PersistedConversation> {
  await joinParticipant(db, conversation.id, actor.id, now);
  return persistMemberTurn(db, conversation, actor, text);
}

async function persistParticipantTalk(
  db: BotSession,
  conversation: OpenConversation,
  actor: User,
  text: string,
): Promise<PersistedConversation> {
  if (await isParticipant(db, conversation.id, actor.id)) {
    return persistMemberTurn(db, conversation, actor, text);
  }
  return persistBystanderTurn(db, conversation, actor, text);
}

function persistTalkInConversation(
  db: BotSession,
  conversation: OpenConversation,
  actor: User,
  text: string,
  now: Date,
): Promise<PersistedConversation> {
  if (specialToken(text) === "wake") {
    return persistWakeTurn(db, conversation, actor, text, now);
  }
  return persistParticipantTalk(db, conversation, actor, text);
}

async function persistTalk(
  db: BotSession,
  open: Awaited<ReturnType<typeof findOpenConversation>>,
  actor: User,
  chatId: number,
  text: string,
  now: Date,
): Promise<PersistedConversation> {
  if (open === null && specialToken(text) !== "wake") {
    return SILENCE;
  }
  const conversation = await conversationFor(db, open, chatId, now);
  return persistTalkInConversation(db, conversation, actor, text, now);
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
  }
  return { kind: "closed" };
}

async function persistStopForOpen(
  db: BotSession,
  conversation: OpenConversation,
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
  open: Awaited<ReturnType<typeof findOpenConversation>>,
  actor: User,
  now: Date,
): Promise<PersistedConversation> {
  if (open === null) {
    return Promise.resolve(SILENCE);
  }
  return persistStopForOpen(db, open, actor, now);
}

function persistStopOrTalk(
  db: BotSession,
  open: Awaited<ReturnType<typeof findOpenConversation>>,
  actor: User,
  chatId: number,
  text: string,
  now: Date,
): Promise<PersistedConversation> {
  if (specialToken(text) === "stop") {
    return persistStop(db, open, actor, now);
  }
  return persistTalk(db, open, actor, chatId, text, now);
}

async function persistConversationMessage(
  db: BotSession,
  message: Message,
  actor: User,
  text: string,
): Promise<PersistedConversation> {
  const now = telegramDateToPostedAt(message.date);
  const open = await findOpenConversation(db, message.chat.id);
  return persistStopOrTalk(db, open, actor, message.chat.id, text, now);
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
