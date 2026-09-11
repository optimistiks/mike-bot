import type { BotDatabase } from "#src/db/runtime.js";
import type { HandlerResult } from "#src/outcomes.js";

import {
  bindSentryConversation,
  endCompletionLease,
  listMembersByIds,
  listTurns,
  tryBeginCompletionLease,
} from "#src/db/store.js";
import { logInfo } from "#src/log.js";

import type { PersistedChat } from "./apply.js";
import type { ChatCompletion } from "./model.js";
import type { ChatCompleteInput, ChatTurn, ReplyMark, SpeakerIdentity } from "./types.js";

import { modelTurn } from "./apply.js";
import { replyMark, speakerHandle } from "./label.js";
import { complete } from "./model.js";
import { reportUnhandledFailure } from "./observability.js";
import { chatMessages } from "./prompt.js";

interface PendingTurn {
  type: "pending-turn";
  addresseeLabel: string;
  chatId: number;
  memberId: number;
  messageId: number;
  now: Date;
  text: string;
}

type ChatWork = HandlerResult | PendingTurn;

const CHAT_SILENCE: HandlerResult = { kind: "silence", type: "chat" };
const COMPLETION_LEASE_TTL_MS = 15_000;

function chatWork(persisted: PersistedChat): ChatWork {
  if (persisted.kind === "turn") {
    return {
      addresseeLabel: persisted.addresseeLabel,
      chatId: persisted.chatId,
      memberId: persisted.memberId,
      messageId: persisted.messageId,
      now: persisted.now,
      text: persisted.text,
      type: "pending-turn",
    };
  }
  return { kind: persisted.kind, type: "chat" };
}

function wakeReply(pending: PendingTurn): ReplyMark {
  return replyMark(pending.addresseeLabel, pending.text, pending.messageId, pending.now);
}

function replyFromText(completion: ChatCompletion): HandlerResult {
  if (completion.text === "") {
    return CHAT_SILENCE;
  }
  return {
    ...(completion.entities === undefined ? {} : { entities: completion.entities }),
    kind: "reply",
    ...(completion.linkPreviewDisabled === true ? { linkPreviewDisabled: true } : {}),
    text: completion.text,
    type: "chat",
  };
}

function firstSpeakerIds(turns: ChatTurn[]): number[] {
  const ids: number[] = [];
  const seen = new Set<number>();
  for (const turn of turns) {
    if (turn.role === "member" && turn.memberId !== null && !seen.has(turn.memberId)) {
      seen.add(turn.memberId);
      ids.push(turn.memberId);
    }
  }
  return ids;
}

function identityFromRow(row: {
  firstName: string | null;
  lastName: string | null;
  username: string | null;
}): SpeakerIdentity {
  return {
    firstName: row.firstName,
    handle: speakerHandle(row.username ?? undefined, row.firstName ?? undefined),
    lastName: row.lastName,
  };
}

function fallbackIdentity(turns: ChatTurn[], memberId: number): SpeakerIdentity {
  const turn = turns.find((entry) => entry.role === "member" && entry.memberId === memberId);
  const handle = turn !== undefined && turn.role === "member" ? turn.label : "???";
  return { firstName: null, handle, lastName: null };
}

async function speakersForTurns(db: BotDatabase, turns: ChatTurn[]): Promise<SpeakerIdentity[]> {
  const ids = firstSpeakerIds(turns);
  if (ids.length === 0) {
    return [];
  }
  const rows = await listMembersByIds(db, ids);
  const byId = new Map(rows.map((row) => [row.telegramId, row]));
  return ids.map((id) => {
    const row = byId.get(id);
    if (row === undefined) {
      return fallbackIdentity(turns, id);
    }
    return identityFromRow(row);
  });
}

async function completeInput(
  db: BotDatabase,
  pending: PendingTurn,
  sentryConversationId: string,
): Promise<ChatCompleteInput> {
  const rows = await listTurns(db, pending.chatId);
  const turns = rows.map((row) => modelTurn(row));
  return {
    addresseeLabel: pending.addresseeLabel,
    memberId: pending.memberId,
    now: pending.now,
    sentryConversationId,
    speakers: await speakersForTurns(db, turns),
    turns,
  };
}

async function runCompletion(db: BotDatabase, pending: PendingTurn): Promise<HandlerResult> {
  try {
    const sentryConversationId = await db.transaction((session) =>
      bindSentryConversation(session, pending.chatId, pending.now),
    );
    const input = await completeInput(db, pending, sentryConversationId);
    const completion = await complete(input);
    return replyFromText(completion);
  } catch (error) {
    reportUnhandledFailure(error);
    return CHAT_SILENCE;
  }
}

async function skipInFlight(db: BotDatabase, pending: PendingTurn): Promise<HandlerResult> {
  const input = await completeInput(db, pending, "");
  logInfo(
    JSON.stringify({
      completion: null,
      prompt: chatMessages(input),
    }),
  );
  return CHAT_SILENCE;
}

async function completePendingTurn(db: BotDatabase, pending: PendingTurn): Promise<HandlerResult> {
  const leaseAt = await tryBeginCompletionLease(
    db,
    pending.chatId,
    pending.memberId,
    new Date(),
    COMPLETION_LEASE_TTL_MS,
  );
  if (leaseAt === null) {
    return skipInFlight(db, pending);
  }
  try {
    return await runCompletion(db, pending);
  } finally {
    await endCompletionLease(db, pending.chatId, pending.memberId, leaseAt);
  }
}

function finishChatWork(db: BotDatabase, work: ChatWork): Promise<HandlerResult> {
  if (work.type === "pending-turn") {
    return completePendingTurn(db, work);
  }
  return Promise.resolve(work);
}

export { chatWork, finishChatWork, wakeReply, type ChatWork, type PendingTurn };
