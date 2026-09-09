import type { Message, User } from "grammy/types";

import type { BotSession } from "#src/db/runtime.js";
import type { MarkType } from "#src/domain/mark.js";
import type { ScoringOutcome } from "#src/outcomes.js";

import { ensureMessage, tryInsertMark, upsertMember } from "#src/db/store.js";
import { isBotUser, telegramDateToPostedAt } from "#src/telegram/identity.js";

import { acknowledgementText, scoringToken } from "./token.js";

function isSelfOrForeignBot(actor: User, subject: User, botUserId: number | undefined): boolean {
  return subject.id === actor.id || (isBotUser(subject) && subject.id !== botUserId);
}

async function persistScoring(
  db: BotSession,
  message: Message,
  actor: User,
  marked: Message,
  subject: User,
  type: MarkType,
): Promise<ScoringOutcome> {
  await upsertMember(db, subject);
  await ensureMessage(db, marked);

  const inserted = await tryInsertMark(db, {
    actorId: actor.id,
    chatId: message.chat.id,
    createdAt: telegramDateToPostedAt(message.date),
    messageId: marked.message_id,
    subjectId: subject.id,
    type,
  });

  if (!inserted) {
    return { kind: "ignored" };
  }

  return {
    kind: "accepted",
    text: acknowledgementText(type, actor.username),
  };
}

function tryApplyScoring(
  db: BotSession,
  message: Message,
  botUserId: number | undefined,
): Promise<ScoringOutcome | null> {
  const actor = message.from;
  const { text } = message;
  if (actor === undefined || text === undefined) {
    return Promise.resolve(null);
  }
  const type = scoringToken(text);
  if (type === null) {
    return Promise.resolve(null);
  }
  const marked = message.reply_to_message;
  const subject = marked?.from;
  if (
    marked === undefined ||
    subject === undefined ||
    isSelfOrForeignBot(actor, subject, botUserId)
  ) {
    return Promise.resolve({ kind: "ignored" });
  }
  return persistScoring(db, message, actor, marked, subject, type);
}

export { tryApplyScoring };
