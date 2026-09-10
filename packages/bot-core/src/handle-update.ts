import type { Message, Update } from "grammy/types";

import type { ChatWork } from "./chat/pending.js";
import type { BotDatabase, BotSession } from "./db/runtime.js";
import type { HandlerResult } from "./outcomes.js";

import { persistChat, persistSilentMemberTurn } from "./chat/apply.js";
import { chatWork, finishChatWork } from "./chat/pending.js";
import { claimUpdate, upsertMember } from "./db/store.js";
import { tryApplyScoring } from "./scoring/apply.js";
import { applyStandings } from "./standings/apply.js";
import { botCommand } from "./telegram/text.js";

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
  message: Message,
  command: string,
): Promise<HandlerResult> {
  if (command === "stats") {
    const outcome = await applyStandings(db, message);
    return { type: "standings", ...outcome };
  }
  return { type: "noop" };
}

async function handleNonCommand(
  db: BotSession,
  message: Message,
  botUserId: number | undefined,
): Promise<ChatWork> {
  const scoring = await tryApplyScoring(db, message, botUserId);
  if (scoring !== null) {
    await persistSilentMemberTurn(db, message, botUserId);
    return { type: "scoring", ...scoring };
  }
  return chatWork(await persistChat(db, message, botUserId));
}

function routeMessage(
  db: BotSession,
  message: Message,
  botUserId: number | undefined,
): Promise<ChatWork> {
  const command = botCommand(message);
  if (command !== null) {
    return handleCommand(db, message, command.name);
  }
  return handleNonCommand(db, message, botUserId);
}

async function dispatchClaimed(
  db: BotSession,
  update: Update,
  botUserId: number | undefined,
): Promise<ChatWork> {
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
): Promise<ChatWork> {
  return db.transaction(async (session) => {
    if (!(await claimUpdate(session, update.update_id))) {
      return { type: "noop" };
    }
    return dispatchClaimed(session, update, botUserId);
  });
}

function persistUpdate(
  update: Update,
  { botUserId, db }: { botUserId?: number; db: BotDatabase },
): Promise<ChatWork> {
  return claimAndDispatch(db, update, botUserId);
}

async function handleUpdate(
  update: Update,
  { botUserId, db }: { botUserId?: number; db: BotDatabase },
): Promise<HandlerResult> {
  const work = await persistUpdate(update, { botUserId, db });
  return finishChatWork(db, work);
}

export { handleUpdate, persistUpdate };
