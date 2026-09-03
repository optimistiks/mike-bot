import type { Message, User } from "grammy/types";

import type { BotSession } from "#src/db/runtime.js";
import type { MarkType } from "#src/domain/mark.js";
import type { ScoringOutcome } from "#src/outcomes.js";

import { ensureMessage, tryInsertMark, upsertMember } from "#src/db/store.js";
import { isBotUser, telegramDateToPostedAt } from "#src/telegram/identity.js";

import { acknowledgementText, scoringToken } from "./token.js";

function isSelfOrBot(actor: User, subject: User): boolean {
  return subject.id === actor.id || isBotUser(subject);
}

function scoringSubject(
  actor: User,
  marked: Message,
): { marked: Message; subject: User } | undefined {
  const { from } = marked;
  if (from === undefined || isSelfOrBot(actor, from)) {
    return undefined;
  }
  return { marked, subject: from };
}

function scoringTarget(
  actor: User,
  marked: Message | undefined,
): { marked: Message; subject: User } | undefined {
  if (marked === undefined) {
    return undefined;
  }
  return scoringSubject(actor, marked);
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

function applyScoringType(
  db: BotSession,
  message: Message,
  actor: User,
  type: MarkType,
): Promise<ScoringOutcome> {
  const target = scoringTarget(actor, message.reply_to_message);
  if (target === undefined) {
    return Promise.resolve({ kind: "ignored" });
  }
  return persistScoring(db, message, actor, target.marked, target.subject, type);
}

function applyScoringText(
  db: BotSession,
  message: Message,
  actor: User,
  text: string,
): Promise<ScoringOutcome> {
  const type = scoringToken(text);
  if (type === null) {
    return Promise.resolve({ kind: "ignored" });
  }
  return applyScoringType(db, message, actor, type);
}

function applyScoring(db: BotSession, message: Message): Promise<ScoringOutcome> {
  const actor = message.from;
  const { text } = message;
  if (actor === undefined || text === undefined) {
    return Promise.resolve({ kind: "ignored" });
  }
  return applyScoringText(db, message, actor, text);
}

export { applyScoring };
