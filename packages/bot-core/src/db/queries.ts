import { and, eq } from "drizzle-orm";

import type { MarkType } from "#src/domain/mark.js";

import { EMPTY_COUNT, SINGLE_COUNT } from "#src/constants.js";

import type { BotSession } from "./runtime.js";

import { conversationTurns, marks } from "./schema.js";
import { findOpenConversation } from "./store.js";

async function markExists(
  db: BotSession,
  query: {
    chatId: number;
    actorId: number;
    messageId: number;
    type: MarkType;
  },
): Promise<boolean> {
  const rows = await db
    .select({ type: marks.type })
    .from(marks)
    .where(
      and(
        eq(marks.chatId, query.chatId),
        eq(marks.actorId, query.actorId),
        eq(marks.messageId, query.messageId),
        eq(marks.type, query.type),
      ),
    )
    .limit(SINGLE_COUNT);
  return rows.length > EMPTY_COUNT;
}

async function isConversationOpen(
  db: BotSession,
  query: { chatId: number; memberId: number },
): Promise<boolean> {
  const open = await findOpenConversation(db, query.memberId, query.chatId);
  return open !== null;
}

async function openConversationMemberTurns(
  db: BotSession,
  query: { chatId: number; memberId: number },
): Promise<string[]> {
  const open = await findOpenConversation(db, query.memberId, query.chatId);
  if (open === null) {
    return [];
  }

  const turns = await db
    .select({ role: conversationTurns.role, text: conversationTurns.text })
    .from(conversationTurns)
    .where(eq(conversationTurns.conversationId, open.id))
    .orderBy(conversationTurns.seq);

  return turns.filter((turn) => turn.role === "member").map((turn) => turn.text);
}

export { isConversationOpen, markExists, openConversationMemberTurns };
