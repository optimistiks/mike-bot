import type { Message, User } from "grammy/types";

import type { ConversationTurn } from "#src/conversation/types.js";
import type { BotSession } from "#src/db/runtime.js";

import {
  appendTurn,
  closeConversation,
  findOpenConversation,
  listTurns,
  openConversation,
} from "#src/db/store.js";
import { telegramDateToPostedAt } from "#src/telegram/identity.js";
import { isStopMessage, isWakeMessage } from "#src/telegram/text.js";

type ConversationTurnRow = Awaited<ReturnType<typeof listTurns>>[number];
type OpenConversation = NonNullable<Awaited<ReturnType<typeof findOpenConversation>>>;

type PersistedConversation =
  | { kind: "closed" }
  | { kind: "silence" }
  | { kind: "turn"; conversationId: string; history: ConversationTurn[] };

function shouldStaySilent(
  open: Awaited<ReturnType<typeof findOpenConversation>>,
  text: string,
): boolean {
  return open === null && !isWakeMessage(text);
}

function conversationFor(
  db: BotSession,
  open: Awaited<ReturnType<typeof findOpenConversation>>,
  actor: User,
  chatId: number,
  now: Date,
): Promise<OpenConversation> {
  if (open !== null) {
    return Promise.resolve(open);
  }
  return openConversation(db, actor.id, chatId, now);
}

function modelTurn(row: ConversationTurnRow): ConversationTurn {
  if (row.role === "assistant") {
    return { role: "assistant", text: row.text };
  }
  return { role: "member", text: row.text };
}

async function persistMemberTurn(
  db: BotSession,
  conversation: OpenConversation,
  text: string,
): Promise<PersistedConversation> {
  await appendTurn(db, conversation.id, "member", text);
  const history = await listTurns(db, conversation.id);
  return {
    conversationId: conversation.id,
    history: history.map((row) => modelTurn(row)),
    kind: "turn",
  };
}

async function persistWakeTurn(
  db: BotSession,
  open: Awaited<ReturnType<typeof findOpenConversation>>,
  actor: User,
  chatId: number,
  text: string,
  now: Date,
): Promise<PersistedConversation> {
  const conversation = await conversationFor(db, open, actor, chatId, now);
  return persistMemberTurn(db, conversation, text);
}

function persistWake(
  db: BotSession,
  open: Awaited<ReturnType<typeof findOpenConversation>>,
  actor: User,
  chatId: number,
  text: string,
  now: Date,
): Promise<PersistedConversation> {
  if (shouldStaySilent(open, text)) {
    return Promise.resolve({ kind: "silence" });
  }
  return persistWakeTurn(db, open, actor, chatId, text, now);
}

async function persistOpenOrWake(
  db: BotSession,
  open: Awaited<ReturnType<typeof findOpenConversation>>,
  actor: User,
  chatId: number,
  text: string,
  now: Date,
): Promise<PersistedConversation> {
  if (open !== null && isStopMessage(text)) {
    await closeConversation(db, open.id, now);
    return { kind: "closed" };
  }
  return persistWake(db, open, actor, chatId, text, now);
}

async function persistConversationMessage(
  db: BotSession,
  message: Message,
  actor: User,
  text: string,
): Promise<PersistedConversation> {
  const now = telegramDateToPostedAt(message.date);
  const open = await findOpenConversation(db, actor.id, message.chat.id);
  return persistOpenOrWake(db, open, actor, message.chat.id, text, now);
}

function persistConversation(db: BotSession, message: Message): Promise<PersistedConversation> {
  const actor = message.from;
  const { text } = message;
  if (actor === undefined || text === undefined) {
    return Promise.resolve({ kind: "silence" });
  }
  return persistConversationMessage(db, message, actor, text);
}

export { persistConversation, type PersistedConversation };
