import { and, eq } from "drizzle-orm";

import type { MarkType } from "../domain/mark";
import type { BotSession } from "./runtime";
import { conversationTurns, conversations, marks } from "./schema";

export async function markExists(
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
    .limit(1);
  return rows.length > 0;
}

export async function isConversationOpen(
  db: BotSession,
  query: { chatId: number; memberId: number },
): Promise<boolean> {
  const rows = await db
    .select({ closedAt: conversations.closedAt })
    .from(conversations)
    .where(and(eq(conversations.memberId, query.memberId), eq(conversations.chatId, query.chatId)));
  return rows.some((row) => row.closedAt === null);
}

export async function openConversationMemberTurns(
  db: BotSession,
  query: { chatId: number; memberId: number },
): Promise<string[]> {
  const open = (
    await db
      .select()
      .from(conversations)
      .where(
        and(eq(conversations.memberId, query.memberId), eq(conversations.chatId, query.chatId)),
      )
  ).find((row) => row.closedAt === null);

  if (open === undefined) {
    return [];
  }

  const turns = await db
    .select({ role: conversationTurns.role, text: conversationTurns.text })
    .from(conversationTurns)
    .where(eq(conversationTurns.conversationId, open.id))
    .orderBy(conversationTurns.seq);

  return turns.filter((turn) => turn.role === "member").map((turn) => turn.text);
}
