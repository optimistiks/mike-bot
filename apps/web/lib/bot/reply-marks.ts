import type { Context } from "grammy";

import type { AppDatabase } from "@/lib/db/runtime";
import type { EventType } from "@/lib/domain/event";
import { creditedSeasonForReaction } from "@/lib/scoring";

import { isGroupChat } from "./chat";
import { applyMarkChanges } from "./marks";

/** What the bot says in the Chat once it has taken the Scoring reply's place. */
const ACKNOWLEDGEMENT_LABEL: Record<EventType, string> = {
  "karma.plus": "➕",
  "karma.minus": "➖",
  "humor.add": "лол",
};

export interface ReplyMarkAcknowledgement {
  /** The marked Message, which the acknowledgement replies to in the reply's place. */
  replyToMessageId: number;
  text: string;
}

export function replyTextToEventType(text: string): EventType | null {
  const normalized = text.trim();
  if (normalized === "+") return "karma.plus";
  if (normalized === "-") return "karma.minus";
  if (normalized.toLocaleLowerCase("ru-RU") === "лол") return "humor.add";
  return null;
}

/**
 * Name the Actor without mentioning them. Deliberately not `memberDisplayName`:
 * its `@username` is a real mention, and the bot answers every Mark an Actor
 * gives, so that would notify them for their own routine reactions.
 */
export function acknowledgementName(actor: {
  username?: string;
  first_name: string;
}): string {
  return actor.username ?? actor.first_name;
}

export function acknowledgementText(
  type: EventType,
  actor: { username?: string; first_name: string },
): string {
  return `${ACKNOWLEDGEMENT_LABEL[type]} (${acknowledgementName(actor)})`;
}

/**
 * Create a permanent Mark for a supported reply and describe how to answer it.
 * Returns null when the reply is not a Scoring reply or repeats an Active Mark.
 */
export async function handleReplyMark(
  db: AppDatabase,
  ctx: Context,
): Promise<ReplyMarkAcknowledgement | null> {
  const message = ctx.message;
  const actor = ctx.from;
  const repliedTo = message?.reply_to_message;
  const subject = repliedTo?.from;
  if (
    !message?.text ||
    !actor ||
    actor.is_bot ||
    !ctx.chat ||
    !isGroupChat(ctx.chat.type) ||
    !repliedTo ||
    !subject ||
    subject.is_bot ||
    actor.id === subject.id
  ) {
    return null;
  }

  const type = replyTextToEventType(message.text);
  if (!type) return null;

  const createdAt = new Date(message.date * 1_000);
  const messageDate = new Date(repliedTo.date * 1_000);
  if (creditedSeasonForReaction(messageDate, createdAt) === null) return null;

  const result = await applyMarkChanges(db, {
    identity: {
      chatId: ctx.chat.id,
      actorId: actor.id,
      subjectId: subject.id,
      messageId: repliedTo.message_id,
    },
    changes: [{ action: "add", type }],
    createdAt,
    additionsAreReversible: false,
  });

  if (result.additions !== 1) return null;

  return {
    replyToMessageId: repliedTo.message_id,
    text: acknowledgementText(type, actor),
  };
}
