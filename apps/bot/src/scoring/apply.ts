import type { Message } from "grammy/types";

import type { ScoringOutcome } from "../outcomes.js";
import type { BotSession } from "../db/runtime.js";
import { ensureMessage, tryInsertMark, upsertMember } from "../db/store.js";
import { isBotUser } from "../telegram/identity.js";
import { acknowledgementText, scoringToken } from "./token.js";

export async function applyScoring(db: BotSession, message: Message): Promise<ScoringOutcome> {
  const actor = message.from;
  const text = message.text;
  if (actor === undefined || text === undefined) {
    return { kind: "ignored" };
  }

  const type = scoringToken(text);
  if (type === null) {
    return { kind: "ignored" };
  }

  const marked = message.reply_to_message;
  const subject = marked?.from;
  if (
    marked === undefined ||
    subject === undefined ||
    subject.id === actor.id ||
    isBotUser(subject)
  ) {
    return { kind: "ignored" };
  }

  await upsertMember(db, subject);
  await ensureMessage(db, marked);

  const inserted = await tryInsertMark(db, {
    chatId: message.chat.id,
    actorId: actor.id,
    subjectId: subject.id,
    messageId: marked.message_id,
    type,
    createdAt: new Date(message.date * 1000),
  });

  if (!inserted) {
    return { kind: "ignored" };
  }

  return {
    kind: "accepted",
    text: acknowledgementText(type, actor.username),
  };
}
