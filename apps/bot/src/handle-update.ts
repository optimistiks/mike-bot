import type { Message, Update } from "grammy/types";

import type { ConversationModel } from "./conversation/types.js";
import type { BotDatabase, BotSession } from "./db/runtime.js";
import type { HandlerResult } from "./outcomes.js";

import { applyConversation } from "./conversation/apply.js";
import { claimUpdate, upsertMember } from "./db/store.js";
import { applyScoring } from "./scoring/apply.js";
import { scoringToken } from "./scoring/token.js";
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
  model: ConversationModel,
): Promise<HandlerResult> {
  if (message.text !== undefined && scoringToken(message.text) !== null) {
    const outcome = await applyScoring(db, message);
    return { type: "scoring", ...outcome };
  }
  const outcome = await applyConversation(db, message, model);
  return { type: "conversation", ...outcome };
}

function routeMessage(
  db: BotSession,
  message: Message,
  model: ConversationModel,
): Promise<HandlerResult> {
  const command = botCommandName(message);
  if (command !== null) {
    return handleCommand(db, message.chat.id, command);
  }
  return handleNonCommand(db, message, model);
}

async function dispatchClaimed(
  db: BotSession,
  update: Update,
  model: ConversationModel,
): Promise<HandlerResult> {
  const message = inboundMessage(update);
  if (!hasSender(message)) {
    return { type: "noop" };
  }
  await upsertMember(db, message.from);
  return routeMessage(db, message, model);
}

async function handleUpdate(
  update: Update,
  ports: { db: BotDatabase; model: ConversationModel },
): Promise<HandlerResult> {
  if (!(await claimUpdate(ports.db, update.update_id))) {
    return { type: "noop" };
  }
  return dispatchClaimed(ports.db, update, ports.model);
}

export { handleUpdate };
