import type { BotDatabase } from "#src/db/runtime.js";
import type { HandlerResult } from "#src/outcomes.js";

import { appendTurn, trimIfClosed } from "#src/db/store.js";

import type { PersistedConversation } from "./apply.js";
import type { ConversationModel, ConversationTurn } from "./types.js";

import { endCompletion, tryBeginCompletion } from "./inflight.js";
import { logCompletionAttempt } from "./log.js";
import { conversationMessages } from "./prompt.js";

interface PendingTurn {
  type: "pending-turn";
  addresseeLabel: string;
  conversationId: string;
  history: ConversationTurn[];
  memberId: number;
}

type ConversationWork = HandlerResult | PendingTurn;

const CONVERSATION_SILENCE: HandlerResult = { kind: "silence", type: "conversation" };

function conversationWork(persisted: PersistedConversation): ConversationWork {
  if (persisted.kind === "turn") {
    return {
      addresseeLabel: persisted.addresseeLabel,
      conversationId: persisted.conversationId,
      history: persisted.history,
      memberId: persisted.memberId,
      type: "pending-turn",
    };
  }
  return { kind: persisted.kind, type: "conversation" };
}

function isPendingTurn(work: ConversationWork): work is PendingTurn {
  return work.type === "pending-turn";
}

async function persistAssistantTurn(
  db: BotDatabase,
  conversationId: string,
  text: string,
): Promise<void> {
  await db.transaction(async (session) => {
    await appendTurn(session, conversationId, "assistant", text, null);
    await trimIfClosed(session, conversationId);
  });
}

async function persistAssistantAndReply(
  db: BotDatabase,
  conversationId: string,
  text: string,
): Promise<HandlerResult> {
  await persistAssistantTurn(db, conversationId, text);
  return { kind: "reply", text, type: "conversation" };
}

function replyFromText(
  db: BotDatabase,
  conversationId: string,
  text: string,
): Promise<HandlerResult> {
  if (text === "") {
    return Promise.resolve(CONVERSATION_SILENCE);
  }
  return persistAssistantAndReply(db, conversationId, text);
}

async function runCompletion(
  db: BotDatabase,
  model: ConversationModel,
  pending: PendingTurn,
): Promise<HandlerResult> {
  try {
    const reply = await model.complete({
      addresseeLabel: pending.addresseeLabel,
      turns: pending.history,
    });
    return await replyFromText(db, pending.conversationId, reply);
  } catch {
    return CONVERSATION_SILENCE;
  }
}

async function finishCompletion(
  db: BotDatabase,
  model: ConversationModel,
  pending: PendingTurn,
): Promise<HandlerResult> {
  try {
    return await runCompletion(db, model, pending);
  } finally {
    endCompletion(pending.conversationId, pending.memberId);
  }
}

function skipInFlight(pending: PendingTurn): HandlerResult {
  logCompletionAttempt({
    completion: null,
    filters: ["in-flight"],
    prompt: conversationMessages(pending.history, pending.addresseeLabel),
  });
  return CONVERSATION_SILENCE;
}

function completePendingTurn(
  db: BotDatabase,
  model: ConversationModel,
  pending: PendingTurn,
): Promise<HandlerResult> {
  if (!tryBeginCompletion(pending.conversationId, pending.memberId)) {
    return Promise.resolve(skipInFlight(pending));
  }
  return finishCompletion(db, model, pending);
}

function finishConversationWork(
  db: BotDatabase,
  model: ConversationModel,
  work: ConversationWork,
): Promise<HandlerResult> {
  if (isPendingTurn(work)) {
    return completePendingTurn(db, model, work);
  }
  return Promise.resolve(work);
}

export { conversationWork, finishConversationWork, type ConversationWork };
