import type { BotDatabase } from "#src/db/runtime.js";
import type { HandlerResult } from "#src/outcomes.js";

import { appendTurn, listMembersByIds, trimIfClosed } from "#src/db/store.js";
import { logInfo } from "#src/log.js";

import type { PersistedConversation } from "./apply.js";
import type {
  ConversationCompleteInput,
  ConversationTurn,
  ReplyMark,
  SpeakerIdentity,
} from "./types.js";

import { replyMark, speakerHandle } from "./label.js";
import { complete } from "./model.js";
import { reportUnhandledFailure } from "./observability.js";
import { conversationMessages } from "./prompt.js";

interface PendingTurn {
  type: "pending-turn";
  addresseeLabel: string;
  conversationId: string;
  history: ConversationTurn[];
  memberId: number;
  now: Date;
}

type ConversationWork = HandlerResult | PendingTurn;

const CONVERSATION_SILENCE: HandlerResult = { kind: "silence", type: "conversation" };
const MS_PER_SECOND = 1000;
const inflight = new Set<string>();

function conversationWork(persisted: PersistedConversation): ConversationWork {
  if (persisted.kind === "turn") {
    return {
      addresseeLabel: persisted.addresseeLabel,
      conversationId: persisted.conversationId,
      history: persisted.history,
      memberId: persisted.memberId,
      now: persisted.now,
      type: "pending-turn",
    };
  }
  return { kind: persisted.kind, type: "conversation" };
}

function participantKey(conversationId: string, memberId: number): string {
  return `${conversationId}:${String(memberId)}`;
}

function tryBeginCompletion(conversationId: string, memberId: number): boolean {
  const key = participantKey(conversationId, memberId);
  if (inflight.has(key)) {
    return false;
  }
  inflight.add(key);
  return true;
}

function endCompletion(conversationId: string, memberId: number): void {
  inflight.delete(participantKey(conversationId, memberId));
}

function completionPostedAt(): Date {
  return new Date(Math.floor(Date.now() / MS_PER_SECOND) * MS_PER_SECOND);
}

function wakeReply(pending: PendingTurn): ReplyMark {
  const last = pending.history.at(-1);
  if (last === undefined || last.role !== "member") {
    return replyMark(pending.addresseeLabel, "");
  }
  return replyMark(pending.addresseeLabel, last.text);
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
    await trimIfClosed(session, conversationId);
  });
}

async function replyFromText(
  db: BotDatabase,
  pending: PendingTurn,
  text: string,
): Promise<HandlerResult> {
  if (text === "") {
    return CONVERSATION_SILENCE;
  }
  await persistAssistantTurn(db, pending.conversationId, text, wakeReply(pending));
  return { kind: "reply", text, type: "conversation" };
}

function firstSpeakerIds(turns: ConversationTurn[]): number[] {
  const ids: number[] = [];
  const seen = new Set<number>();
  for (const turn of turns) {
    if (turn.role !== "member" || turn.memberId === null || seen.has(turn.memberId)) {
      continue;
    }
    seen.add(turn.memberId);
    ids.push(turn.memberId);
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
  return {
    addresseeLabel: pending.addresseeLabel,
    conversationId: pending.conversationId,
    memberId: pending.memberId,
    now: pending.now,
    speakers: await speakersForTurns(db, pending.history),
    turns: pending.history,
  };
}

async function runCompletion(db: BotDatabase, pending: PendingTurn): Promise<HandlerResult> {
  try {
    const reply = await complete(await completeInput(db, pending));
    return await replyFromText(db, pending, reply);
  } catch (error) {
    reportUnhandledFailure(error);
    return CONVERSATION_SILENCE;
  }
}

async function skipInFlight(db: BotDatabase, pending: PendingTurn): Promise<HandlerResult> {
  logInfo(
    JSON.stringify({
      completion: null,
      prompt: conversationMessages(await completeInput(db, pending)),
    }),
  );
  return CONVERSATION_SILENCE;
}

async function completePendingTurn(db: BotDatabase, pending: PendingTurn): Promise<HandlerResult> {
  if (!tryBeginCompletion(pending.conversationId, pending.memberId)) {
    return skipInFlight(db, pending);
  }
  try {
    return await runCompletion(db, pending);
  } finally {
    endCompletion(pending.conversationId, pending.memberId);
  }
}

function finishConversationWork(db: BotDatabase, work: ConversationWork): Promise<HandlerResult> {
  if (work.type === "pending-turn") {
    return completePendingTurn(db, work);
  }
  return Promise.resolve(work);
}

export { conversationWork, finishConversationWork, type ConversationWork };
