import type { Message, Update } from "grammy/types";

import type { PersistedConversation } from "./conversation/apply.js";
import type { ConversationModel, ConversationTurn } from "./conversation/types.js";
import type { BotDatabase, BotSession } from "./db/runtime.js";
import type { HandlerResult } from "./outcomes.js";

import { persistConversation } from "./conversation/apply.js";
import { appendTurn, claimUpdate, upsertMember } from "./db/store.js";
import { applyScoring } from "./scoring/apply.js";
import { scoringToken } from "./scoring/token.js";
import { applyStandings } from "./standings/apply.js";
import { botCommandName } from "./telegram/text.js";

interface PendingTurn {
  type: "pending-turn";
  conversationId: string;
  history: ConversationTurn[];
}

type ClaimedWork = HandlerResult | PendingTurn;

function inboundMessage(update: Update): Message | undefined {
  return update.message ?? update.channel_post;
}

function hasSender(
  message: Message | undefined,
): message is Message & { from: NonNullable<Message["from"]> } {
  return message !== undefined && message.from !== undefined;
}

function isPendingTurn(work: ClaimedWork): work is PendingTurn {
  return work.type === "pending-turn";
}

async function handleCommand(
  db: BotSession,
  chatId: number,
  command: string,
): Promise<HandlerResult> {
  if (command === "stats") {
    const outcome = await applyStandings(db, chatId);
    return { type: "standings", ...outcome };
  }
  return { type: "noop" };
}

function conversationWork(persisted: PersistedConversation): ClaimedWork {
  if (persisted.kind === "silence") {
    return { kind: "silence", type: "conversation" };
  }
  return {
    conversationId: persisted.conversationId,
    history: persisted.history,
    type: "pending-turn",
  };
}

async function handleNonCommand(db: BotSession, message: Message): Promise<ClaimedWork> {
  if (message.text !== undefined && scoringToken(message.text) !== null) {
    const outcome = await applyScoring(db, message);
    return { type: "scoring", ...outcome };
  }
  return conversationWork(await persistConversation(db, message));
}

function routeMessage(db: BotSession, message: Message): Promise<ClaimedWork> {
  const command = botCommandName(message);
  if (command !== null) {
    return handleCommand(db, message.chat.id, command);
  }
  return handleNonCommand(db, message);
}

async function dispatchClaimed(db: BotSession, update: Update): Promise<ClaimedWork> {
  const message = inboundMessage(update);
  if (!hasSender(message)) {
    return { type: "noop" };
  }
  await upsertMember(db, message.from);
  return routeMessage(db, message);
}

function claimAndDispatch(db: BotDatabase, update: Update): Promise<ClaimedWork> {
  return db.transaction(async (session) => {
    if (!(await claimUpdate(session, update.update_id))) {
      return { type: "noop" };
    }
    return dispatchClaimed(session, update);
  });
}

async function persistAssistantTurn(
  db: BotDatabase,
  conversationId: string,
  text: string,
): Promise<void> {
  await db.transaction(async (session) => {
    await appendTurn(session, conversationId, "assistant", text);
  });
}

async function completePendingTurn(
  db: BotDatabase,
  model: ConversationModel,
  pending: PendingTurn,
): Promise<HandlerResult> {
  try {
    const reply = await model.complete(pending.history);
    await persistAssistantTurn(db, pending.conversationId, reply);
    return { kind: "reply", text: reply, type: "conversation" };
  } catch {
    return { kind: "silence", type: "conversation" };
  }
}

function finishClaimedWork(
  db: BotDatabase,
  model: ConversationModel,
  work: ClaimedWork,
): Promise<HandlerResult> {
  if (isPendingTurn(work)) {
    return completePendingTurn(db, model, work);
  }
  return Promise.resolve(work);
}

async function handleUpdate(
  update: Update,
  ports: { db: BotDatabase; model: ConversationModel },
): Promise<HandlerResult> {
  const work = await claimAndDispatch(ports.db, update);
  return finishClaimedWork(ports.db, ports.model, work);
}

export { handleUpdate };
