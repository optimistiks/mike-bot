import type { BotDatabase } from "#src/db/runtime.js";
import type { HandlerResult } from "#src/outcomes.js";

import {
  appendTurn,
  endCompletionLease,
  findConversationById,
  listMembersByIds,
  listTurns,
  trimOldestTurns,
  tryBeginCompletionLease,
} from "#src/db/store.js";
import { logInfo } from "#src/log.js";

import type { PersistedConversation } from "./apply.js";
import type {
  ConversationCompleteInput,
  ConversationTurn,
  ReplyMark,
  SpeakerIdentity,
} from "./types.js";

import { modelTurn } from "./apply.js";
import { replyMark, speakerHandle } from "./label.js";
import { complete } from "./model.js";
import { reportUnhandledFailure } from "./observability.js";
import { conversationMessages } from "./prompt.js";

interface PendingTurn {
  type: "pending-turn";
  addresseeLabel: string;
  conversationId: string;
  memberId: number;
  now: Date;
  text: string;
}

type ConversationWork = HandlerResult | PendingTurn;

const CONVERSATION_SILENCE: HandlerResult = { kind: "silence", type: "conversation" };
const COMPLETION_LEASE_TTL_MS = 15_000;
const MS_PER_SECOND = 1000;

function conversationWork(persisted: PersistedConversation): ConversationWork {
  if (persisted.kind === "turn") {
    return {
      addresseeLabel: persisted.addresseeLabel,
      conversationId: persisted.conversationId,
      memberId: persisted.memberId,
      now: persisted.now,
      text: persisted.text,
      type: "pending-turn",
    };
  }
  return { kind: persisted.kind, type: "conversation" };
}

function completionPostedAt(): Date {
  return new Date(Math.floor(Date.now() / MS_PER_SECOND) * MS_PER_SECOND);
}

function wakeReply(pending: PendingTurn): ReplyMark {
  return replyMark(pending.addresseeLabel, pending.text);
}

async function persistAssistantTurn(
  db: BotDatabase,
  conversationId: string,
  text: string,
  reply: ReplyMark,
): Promise<void> {
  await db.transaction(async (session) => {
    await appendTurn(session, {
      conversationId,
      memberId: null,
      postedAt: completionPostedAt(),
      replyQuote: reply.quote,
      replyTargetLabel: reply.targetLabel,
      role: "assistant",
      speakerLabel: null,
      text,
    });
    await trimOldestTurns(session, conversationId);
  });
}

async function canComplete(db: BotDatabase, pending: PendingTurn): Promise<boolean> {
  const conversation = await findConversationById(db, pending.conversationId);
  return conversation !== null;
}

async function replyFromText(
  db: BotDatabase,
  pending: PendingTurn,
  text: string,
): Promise<HandlerResult> {
  if (text === "") {
    return CONVERSATION_SILENCE;
  }
  if (!(await canComplete(db, pending))) {
    return CONVERSATION_SILENCE;
  }
  await persistAssistantTurn(db, pending.conversationId, text, wakeReply(pending));
  return { kind: "reply", text, type: "conversation" };
}

function firstSpeakerIds(turns: ConversationTurn[]): number[] {
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

function fallbackIdentity(turns: ConversationTurn[], memberId: number): SpeakerIdentity {
  const turn = turns.find((entry) => entry.role === "member" && entry.memberId === memberId);
  const handle = turn !== undefined && turn.role === "member" ? turn.label : "???";
  return { firstName: null, handle, lastName: null };
}

async function speakersForTurns(
  db: BotDatabase,
  turns: ConversationTurn[],
): Promise<SpeakerIdentity[]> {
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
): Promise<ConversationCompleteInput> {
  const rows = await listTurns(db, pending.conversationId);
  const turns = rows.map((row) => modelTurn(row));
  return {
    addresseeLabel: pending.addresseeLabel,
    conversationId: pending.conversationId,
    memberId: pending.memberId,
    now: pending.now,
    speakers: await speakersForTurns(db, turns),
    turns,
  };
}

async function runCompletion(db: BotDatabase, pending: PendingTurn): Promise<HandlerResult> {
  try {
    if (!(await canComplete(db, pending))) {
      return CONVERSATION_SILENCE;
    }
    const input = await completeInput(db, pending);
    const reply = await complete(input);
    return await replyFromText(db, pending, reply);
  } catch (error) {
    reportUnhandledFailure(error);
    return CONVERSATION_SILENCE;
  }
}

async function skipInFlight(db: BotDatabase, pending: PendingTurn): Promise<HandlerResult> {
  const input = await completeInput(db, pending);
  logInfo(
    JSON.stringify({
      completion: null,
      prompt: conversationMessages(input),
    }),
  );
  return CONVERSATION_SILENCE;
}

async function completePendingTurn(db: BotDatabase, pending: PendingTurn): Promise<HandlerResult> {
  const leaseAt = await tryBeginCompletionLease(
    db,
    pending.conversationId,
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
    await endCompletionLease(db, pending.conversationId, pending.memberId, leaseAt);
  }
}

function finishConversationWork(db: BotDatabase, work: ConversationWork): Promise<HandlerResult> {
  if (work.type === "pending-turn") {
    return completePendingTurn(db, work);
  }
  return Promise.resolve(work);
}

export { conversationWork, finishConversationWork, type ConversationWork };
