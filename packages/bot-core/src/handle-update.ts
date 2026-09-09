import type { Message, Update } from "grammy/types";

import type { ConversationWork } from "./conversation/pending.js";
import type { BotDatabase, BotSession } from "./db/runtime.js";
import type { HandlerResult } from "./outcomes.js";

import { persistConversation } from "./conversation/apply.js";
import { conversationWork, finishConversationWork } from "./conversation/pending.js";
import { claimUpdate, upsertMember } from "./db/store.js";
import { tryApplyScoring } from "./scoring/apply.js";
import { applyStandings } from "./standings/apply.js";
import { botCommandName } from "./telegram/text.js";

function inboundMessage(update: Update): Message | undefined {
  return update.message ?? update.channel_post;
}

function hasSender(
  message: Message | undefined,
): message is Message & { from: NonNullable<Message["from"]> } {
  return message !== undefined && message.from !== undefined;
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

async function handleNonCommand(
  db: BotSession,
  message: Message,
  botUserId: number | undefined,
): Promise<ConversationWork> {
  const scoring = await tryApplyScoring(db, message);
  if (scoring !== null) {
    return { type: "scoring", ...scoring };
  }
  return conversationWork(await persistConversation(db, message, botUserId));
}

function routeMessage(
  db: BotSession,
  message: Message,
  botUserId: number | undefined,
): Promise<ConversationWork> {
  const command = botCommandName(message);
  if (command !== null) {
    return handleCommand(db, message.chat.id, command);
  }
  return handleNonCommand(db, message, botUserId);
}

async function dispatchClaimed(
  db: BotSession,
  update: Update,
  botUserId: number | undefined,
): Promise<ConversationWork> {
  const message = inboundMessage(update);
  if (!hasSender(message)) {
    return { type: "noop" };
  }
  await upsertMember(db, message.from);
  return routeMessage(db, message, botUserId);
}

function claimAndDispatch(
  db: BotDatabase,
  update: Update,
  botUserId: number | undefined,
): Promise<ConversationWork> {
  return db.transaction(async (session) => {
    if (!(await claimUpdate(session, update.update_id))) {
      return { type: "noop" };
    }
    return dispatchClaimed(session, update, botUserId);
  });
}

async function handleUpdate(
  update: Update,
  { botUserId, db }: { botUserId?: number; db: BotDatabase },
): Promise<HandlerResult> {
  const work = await claimAndDispatch(db, update, botUserId);
  return finishConversationWork(db, work);
}

export { handleUpdate };
