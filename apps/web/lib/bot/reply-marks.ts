import type { Context } from "grammy";

import type { AppDatabase } from "@/lib/db/runtime";
import type { EventType } from "@/lib/domain/event";
import { creditedSeasonForReaction } from "@/lib/scoring";

import { isGroupChat } from "./chat";
import { applyMarkChanges } from "./marks";

export function replyTextToEventType(text: string): EventType | null {
  const normalized = text.trim();
  if (normalized === "+") return "karma.plus";
  if (normalized === "-") return "karma.minus";
  if (normalized.toLocaleLowerCase("ru-RU") === "лол") return "humor.add";
  return null;
}

/** Create a permanent Mark for a supported reply and report whether it was new. */
export async function handleReplyMark(
  db: AppDatabase,
  ctx: Context,
): Promise<boolean> {
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
    return false;
  }

  const type = replyTextToEventType(message.text);
  if (!type) return false;

  const createdAt = new Date(message.date * 1_000);
  const messageDate = new Date(repliedTo.date * 1_000);
  if (creditedSeasonForReaction(messageDate, createdAt) === null) return false;

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

  return result.additions === 1;
}
