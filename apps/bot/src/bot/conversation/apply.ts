import type { Message, User } from "grammy/types";

import type { BotSession } from "#src/bot/db/runtime.js";
import type { ConversationOutcome } from "#src/bot/outcomes.js";

import {
  appendTurn,
  closeConversation,
  findOpenConversation,
  listTurns,
  openConversation,
} from "#src/bot/db/store.js";
import { telegramDateToPostedAt } from "#src/bot/telegram/identity.js";
import { isStopMessage, isWakeMessage } from "#src/bot/telegram/text.js";

import type { ConversationModel } from "./types.js";

type OpenConversation = NonNullable<Awaited<ReturnType<typeof findOpenConversation>>>;

async function completeTurn(
  db: BotSession,
  conversation: OpenConversation,
  text: string,
  model: ConversationModel,
): Promise<ConversationOutcome> {
  await appendTurn(db, conversation.id, "member", text);
  const history = await listTurns(db, conversation.id);
  try {
    const reply = await model.complete(
      history.map((turn) => ({
        role: turn.role === "assistant" ? "assistant" : "member",
        text: turn.text,
      })),
    );
    await appendTurn(db, conversation.id, "assistant", reply);
    return { kind: "reply", text: reply };
  } catch {
    return { kind: "silence" };
  }
}

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

async function applyWake(
  db: BotSession,
  open: Awaited<ReturnType<typeof findOpenConversation>>,
  actor: User,
  chatId: number,
  text: string,
  now: Date,
  model: ConversationModel,
): Promise<ConversationOutcome> {
  if (shouldStaySilent(open, text)) {
    return { kind: "silence" };
  }
  const conversation = await conversationFor(db, open, actor, chatId, now);
  return completeTurn(db, conversation, text, model);
}

async function applyOpenOrWake(
  db: BotSession,
  open: Awaited<ReturnType<typeof findOpenConversation>>,
  actor: User,
  chatId: number,
  text: string,
  now: Date,
  model: ConversationModel,
): Promise<ConversationOutcome> {
  if (open !== null && isStopMessage(text)) {
    await closeConversation(db, open.id, now);
    return { kind: "silence" };
  }
  return applyWake(db, open, actor, chatId, text, now, model);
}

async function continueConversation(
  db: BotSession,
  message: Message,
  actor: User,
  text: string,
  model: ConversationModel,
): Promise<ConversationOutcome> {
  const now = telegramDateToPostedAt(message.date);
  const open = await findOpenConversation(db, actor.id, message.chat.id);
  return applyOpenOrWake(db, open, actor, message.chat.id, text, now, model);
}

function applyConversation(
  db: BotSession,
  message: Message,
  model: ConversationModel,
): Promise<ConversationOutcome> {
  const actor = message.from;
  const { text } = message;
  if (actor === undefined || text === undefined) {
    return Promise.resolve({ kind: "silence" });
  }
  return continueConversation(db, message, actor, text, model);
}

export { applyConversation };
