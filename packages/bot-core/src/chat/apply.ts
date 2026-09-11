import type { Message, User } from "grammy/types";

import type { ChatTurn, ReplyMark } from "#src/chat/types.js";
import type { BotDatabase, BotSession } from "#src/db/runtime.js";
import type { chatTurns } from "#src/db/schema.js";

import { replyMark, speakerLabel } from "#src/chat/label.js";
import { isReplyToBot, replyFromMessage } from "#src/chat/reply.js";
import {
  appendTurn,
  findOrMintChat,
  stampLastLlmRepliedAt,
  trimOldestTurns,
} from "#src/db/store.js";
import { telegramDateToPostedAt } from "#src/telegram/identity.js";
import { isWakeMessage } from "#src/telegram/text.js";

type ChatTurnRow = typeof chatTurns.$inferSelect;

interface PersistedTurn {
  addresseeLabel: string;
  chatId: number;
  kind: "turn";
  memberId: number;
  messageId: number;
  now: Date;
  text: string;
}

interface SentAssistantTurn {
  chatId: number;
  messageId: number;
  postedAt: Date;
  reply: ReplyMark;
  text: string;
}

type PersistedChat = { kind: "silence" } | PersistedTurn;

const SILENCE: PersistedChat = { kind: "silence" };

function optionalReply(row: ChatTurnRow): ReplyMark | null {
  if (
    row.replyTargetLabel === null ||
    row.replyToMessageId === null ||
    row.replyPostedAt === null
  ) {
    return null;
  }
  return {
    quote: row.replyQuote,
    targetLabel: row.replyTargetLabel,
    targetMessageId: row.replyToMessageId,
    targetPostedAt: row.replyPostedAt,
  };
}

function requiredReply(row: ChatTurnRow): ReplyMark {
  const reply = optionalReply(row);
  if (reply === null) {
    throw new Error("assistant chat turn is missing reply identity");
  }
  return reply;
}

function modelTurn(row: ChatTurnRow): ChatTurn {
  if (row.role === "assistant") {
    return {
      messageId: row.messageId,
      postedAt: row.postedAt,
      reply: requiredReply(row),
      role: "assistant",
      text: row.text,
    };
  }
  return {
    label: row.speakerLabel ?? "???",
    memberId: row.memberId,
    messageId: row.messageId,
    postedAt: row.postedAt,
    reply: optionalReply(row),
    role: "member",
    text: row.text,
  };
}

function replyColumns(reply: ReplyMark | null): {
  replyPostedAt: Date | null;
  replyQuote: string | null;
  replyTargetLabel: string | null;
  replyToMessageId: number | null;
} {
  if (reply === null) {
    return {
      replyPostedAt: null,
      replyQuote: null,
      replyTargetLabel: null,
      replyToMessageId: null,
    };
  }
  return {
    replyPostedAt: reply.targetPostedAt,
    replyQuote: reply.quote,
    replyTargetLabel: reply.targetLabel,
    replyToMessageId: reply.targetMessageId,
  };
}

function memberTurnInput(
  chatId: number,
  actor: User,
  text: string,
  now: Date,
  messageId: number,
  reply: ReplyMark | null,
): {
  chatId: number;
  memberId: number;
  messageId: number;
  postedAt: Date;
  replyPostedAt: Date | null;
  replyQuote: string | null;
  replyTargetLabel: string | null;
  replyToMessageId: number | null;
  role: "member";
  speakerLabel: string;
  text: string;
} {
  return {
    chatId,
    memberId: actor.id,
    messageId,
    postedAt: now,
    role: "member",
    speakerLabel: speakerLabel(actor),
    text,
    ...replyColumns(reply),
  };
}

function shouldComplete(text: string, message: Message, botUserId: number | undefined): boolean {
  return isWakeMessage(text) || isReplyToBot(message, botUserId);
}

async function persistTalk(
  db: BotSession,
  message: Message,
  actor: User,
  text: string,
  now: Date,
  botUserId: number | undefined,
): Promise<PersistedChat> {
  const chat = await findOrMintChat(db, message.chat.id);
  const input = memberTurnInput(
    chat.chatId,
    actor,
    text,
    now,
    message.message_id,
    replyFromMessage(message, botUserId),
  );
  await appendTurn(db, input);
  await trimOldestTurns(db, chat.chatId);
  if (!shouldComplete(text, message, botUserId)) {
    return SILENCE;
  }
  return {
    addresseeLabel: input.speakerLabel,
    chatId: chat.chatId,
    kind: "turn",
    memberId: actor.id,
    messageId: message.message_id,
    now,
    text,
  };
}

async function persistSilentMemberTurn(
  db: BotSession,
  message: Message,
  botUserId: number | undefined,
): Promise<void> {
  const actor = message.from;
  const { text } = message;
  if (actor === undefined || text === undefined) {
    return;
  }
  const now = telegramDateToPostedAt(message.date);
  const chat = await findOrMintChat(db, message.chat.id);
  const input = memberTurnInput(
    chat.chatId,
    actor,
    text,
    now,
    message.message_id,
    replyFromMessage(message, botUserId),
  );
  await appendTurn(db, { ...input, memberId: null });
  await trimOldestTurns(db, chat.chatId);
}

async function insertAssistantTurn(session: BotSession, turn: SentAssistantTurn): Promise<void> {
  await appendTurn(session, {
    chatId: turn.chatId,
    memberId: null,
    messageId: turn.messageId,
    postedAt: turn.postedAt,
    role: "assistant",
    speakerLabel: null,
    text: turn.text,
    ...replyColumns(turn.reply),
  });
}

async function persistChatAssistantTurn(db: BotDatabase, turn: SentAssistantTurn): Promise<void> {
  await db.transaction(async (session) => {
    await insertAssistantTurn(session, turn);
    await stampLastLlmRepliedAt(session, turn.chatId, turn.postedAt);
    await trimOldestTurns(session, turn.chatId);
  });
}

async function persistStandingsAssistantTurn(
  db: BotDatabase,
  turn: SentAssistantTurn,
): Promise<void> {
  await db.transaction(async (session) => {
    await insertAssistantTurn(session, turn);
    await trimOldestTurns(session, turn.chatId);
  });
}

function commandReplyMark(message: Message): ReplyMark {
  const actor = message.from;
  const commandText = message.text ?? "";
  const label = actor === undefined ? "???" : speakerLabel(actor);
  return replyMark(label, commandText, message.message_id, telegramDateToPostedAt(message.date));
}

function persistChat(
  db: BotSession,
  message: Message,
  botUserId: number | undefined,
): Promise<PersistedChat> {
  const actor = message.from;
  const { text } = message;
  if (actor === undefined || text === undefined) {
    return Promise.resolve(SILENCE);
  }
  const now = telegramDateToPostedAt(message.date);
  return persistTalk(db, message, actor, text, now, botUserId);
}

export {
  commandReplyMark,
  modelTurn,
  persistChat,
  persistChatAssistantTurn,
  persistSilentMemberTurn,
  persistStandingsAssistantTurn,
  type PersistedChat,
  type SentAssistantTurn,
};
