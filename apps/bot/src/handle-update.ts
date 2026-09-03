import type { ConversationModel } from "./conversation/types.js";
import { applyConversation } from "./conversation/apply.js";
import type { BotDatabase, BotSession } from "./db/runtime.js";
import { claimUpdate, upsertMember } from "./db/store.js";
import type { HandlerResult } from "./outcomes.js";
import { applyScoring } from "./scoring/apply.js";
import { scoringToken } from "./scoring/token.js";
import { applyStandings } from "./standings/apply.js";
import { botCommandName } from "./telegram/text.js";
import type { Update } from "grammy/types";

export async function handleUpdate(
  update: Update,
  ports: { db: BotDatabase; model: ConversationModel },
): Promise<HandlerResult> {
  return ports.db.transaction((tx) => handleClaimed(tx, update, ports.model));
}

async function handleClaimed(
  db: BotSession,
  update: Update,
  model: ConversationModel,
): Promise<HandlerResult> {
  if (!(await claimUpdate(db, update.update_id))) {
    return { type: "noop" };
  }

  const message = update.message ?? update.channel_post;
  if (message?.from === undefined) {
    return { type: "noop" };
  }

  await upsertMember(db, message.from);

  const command = botCommandName(message);
  if (command !== null) {
    if (command === "stats") {
      const outcome = await applyStandings(db, message.chat.id);
      return { type: "standings", ...outcome };
    }
    return { type: "noop" };
  }

  if (message.text !== undefined && scoringToken(message.text) !== null) {
    const outcome = await applyScoring(db, message);
    return { type: "scoring", ...outcome };
  }

  const outcome = await applyConversation(db, message, model);
  return { type: "conversation", ...outcome };
}
