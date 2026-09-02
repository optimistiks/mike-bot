import type { Message } from "grammy/types";

import type { ConversationOutcome } from "../outcomes";
import type { BotSession } from "../db/runtime";
import {
  appendTurn,
  closeConversation,
  findOpenConversation,
  listTurns,
  openConversation,
} from "../db/store";
import { isStopMessage, isWakeMessage } from "../telegram/text";
import type { ConversationModel } from "./types";

export async function applyConversation(
  db: BotSession,
  message: Message,
  model: ConversationModel,
): Promise<ConversationOutcome> {
  const actor = message.from;
  const text = message.text;
  if (actor === undefined || text === undefined) {
    return { kind: "silence" };
  }

  const now = new Date(message.date * 1000);
  const open = await findOpenConversation(db, actor.id, message.chat.id);

  if (open !== null && isStopMessage(text)) {
    await closeConversation(db, open.id, now);
    return { kind: "silence" };
  }

  if (open === null && !isWakeMessage(text)) {
    return { kind: "silence" };
  }

  const conversation = open ?? (await openConversation(db, actor.id, message.chat.id, now));

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
