import { and, eq } from "drizzle-orm";

import type { MarkType } from "#src/domain/mark.js";

import { EMPTY_COUNT, SINGLE_COUNT } from "#src/constants.js";

import type { BotSession } from "./runtime.js";

import { conversationTurns, marks } from "./schema.js";
import { findConversation, findOpenConversation, listParticipants } from "./store.js";

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

async function isConversationOpen(db: BotSession, query: { chatId: number }): Promise<boolean> {
  const open = await findOpenConversation(db, query.chatId);
  return open !== null;
}

async function openConversationParticipantIds(
  db: BotSession,
  query: { chatId: number },
): Promise<number[]> {
  const open = await findOpenConversation(db, query.chatId);
  if (open === null) {
    return [];
  }
  const participants = await listParticipants(db, open.id);
  return participants.map((participant) => participant.memberId);
}

function labeledMemberText(label: string | null, text: string): string {
  return `[${label ?? "???"}] ${text}`;
}

function memberTurnText(turn: {
  role: string;
  speakerLabel: string | null;
  text: string;
}): string[] {
  if (turn.role !== "member") {
    return [];
  }
  return [labeledMemberText(turn.speakerLabel, turn.text)];
}

function assistantTurnText(turn: { role: string; text: string }): string[] {
  if (turn.role !== "assistant") {
    return [];
  }
  return [turn.text];
}

async function listChatTurns(
  db: BotSession,
  chatId: number,
): Promise<{ role: string; speakerLabel: string | null; text: string }[]> {
  const conversation = await findConversation(db, chatId);
  if (conversation === null) {
    return [];
  }
  return db
    .select({
      role: conversationTurns.role,
      speakerLabel: conversationTurns.speakerLabel,
      text: conversationTurns.text,
    })
    .from(conversationTurns)
    .where(eq(conversationTurns.conversationId, conversation.id))
    .orderBy(conversationTurns.seq);
}

async function listOpenTurns(
  db: BotSession,
  chatId: number,
): Promise<{ role: string; speakerLabel: string | null; text: string }[]> {
  const open = await findOpenConversation(db, chatId);
  if (open === null) {
    return [];
  }
  return listChatTurns(db, chatId);
}

async function chatConversationMemberTurns(
  db: BotSession,
  query: { chatId: number },
): Promise<string[]> {
  const turns = await listChatTurns(db, query.chatId);
  return turns.flatMap((turn) => memberTurnText(turn));
}

async function chatConversationTurnCount(
  db: BotSession,
  query: { chatId: number },
): Promise<number> {
  const turns = await listChatTurns(db, query.chatId);
  return turns.length;
}

async function openConversationMemberTurns(
  db: BotSession,
  query: { chatId: number },
): Promise<string[]> {
  const turns = await listOpenTurns(db, query.chatId);
  return turns.flatMap((turn) => memberTurnText(turn));
}

async function openConversationAssistantTurns(
  db: BotSession,
  query: { chatId: number },
): Promise<string[]> {
  const turns = await listOpenTurns(db, query.chatId);
  return turns.flatMap((turn) => assistantTurnText(turn));
}

export {
  chatConversationMemberTurns,
  chatConversationTurnCount,
  isConversationOpen,
  markExists,
  openConversationAssistantTurns,
  openConversationMemberTurns,
  openConversationParticipantIds,
};
