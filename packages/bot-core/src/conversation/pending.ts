import type { BotDatabase } from "#src/db/runtime.js";
import type { HandlerResult } from "#src/outcomes.js";

import {
  appendTurn,
  endCompletionLease,
  findConversationById,
  isParticipant,
  latestMemberTurnSeq,
  listMembersByIds,
  listTurns,
  trimIfUnopened,
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
  turnSeq: number;
}

type ConversationWork = HandlerResult | PendingTurn;

interface CompletePendingOptions {
  waitForQuiet?: () => Promise<void>;
}

const CONVERSATION_SILENCE: HandlerResult = { kind: "silence", type: "conversation" };
const COMPLETION_LEASE_TTL_MS = 15_000;
const MS_PER_SECOND = 1000;
const QUIET_WINDOW_MS = 1000;

function conversationWork(persisted: PersistedConversation): ConversationWork {
  if (persisted.kind === "turn") {
    return {
      addresseeLabel: persisted.addresseeLabel,
      conversationId: persisted.conversationId,
      memberId: persisted.memberId,
      now: persisted.now,
      turnSeq: persisted.turnSeq,
      type: "pending-turn",
    };
  }
  return { kind: persisted.kind, type: "conversation" };
}

function waitForQuietWindow(): Promise<void> {
  // eslint-disable-next-line promise/avoid-new -- sleep for the quiet window
  return new Promise((resolve) => {
    setTimeout(resolve, QUIET_WINDOW_MS);
  });
}

function completionPostedAt(): Date {
  return new Date(Math.floor(Date.now() / MS_PER_SECOND) * MS_PER_SECOND);
}

function quotedMemberText(turns: ConversationTurn[], memberId: number): string {
  const last = turns.findLast((turn) => turn.role === "member" && turn.memberId === memberId);
  if (last === undefined || last.role !== "member") {
    return "";
  }
  return last.text;
}

function wakeReply(pending: PendingTurn, turns: ConversationTurn[]): ReplyMark {
  return replyMark(pending.addresseeLabel, quotedMemberText(turns, pending.memberId));
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
    await trimIfUnopened(session, conversationId);
  });
}

async function canComplete(db: BotDatabase, pending: PendingTurn): Promise<boolean> {
  const conversation = await findConversationById(db, pending.conversationId);
  if (conversation === null || conversation.closedAt !== null) {
    return false;
  }
  return isParticipant(db, pending.conversationId, pending.memberId);
}

async function isLatestTurn(db: BotDatabase, pending: PendingTurn): Promise<boolean> {
  const latest = await latestMemberTurnSeq(db, pending.conversationId, pending.memberId);
  return latest === pending.turnSeq;
}

async function replyFromText(
  db: BotDatabase,
  pending: PendingTurn,
  text: string,
  turns: ConversationTurn[],
): Promise<HandlerResult> {
  if (text === "") {
    return CONVERSATION_SILENCE;
  }
  if (!(await canComplete(db, pending))) {
    return CONVERSATION_SILENCE;
  }
  await persistAssistantTurn(db, pending.conversationId, text, wakeReply(pending, turns));
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
    return await replyFromText(db, pending, reply, input.turns);
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

async function completePendingTurn(
  db: BotDatabase,
  pending: PendingTurn,
  waitForQuiet: () => Promise<void>,
): Promise<HandlerResult> {
  await waitForQuiet();
  if (!(await canComplete(db, pending)) || !(await isLatestTurn(db, pending))) {
    return CONVERSATION_SILENCE;
  }
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
    if (!(await canComplete(db, pending)) || !(await isLatestTurn(db, pending))) {
      return CONVERSATION_SILENCE;
    }
    return await runCompletion(db, pending);
  } finally {
    await endCompletionLease(db, pending.conversationId, pending.memberId, leaseAt);
  }
}

function finishConversationWork(
  db: BotDatabase,
  work: ConversationWork,
  options: CompletePendingOptions = {},
): Promise<HandlerResult> {
  if (work.type === "pending-turn") {
    return completePendingTurn(db, work, options.waitForQuiet ?? waitForQuietWindow);
  }
  return Promise.resolve(work);
}

export { conversationWork, finishConversationWork, type ConversationWork };
