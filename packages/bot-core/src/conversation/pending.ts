import type { BotDatabase } from "#src/db/runtime.js";
import type { HandlerResult } from "#src/outcomes.js";

import { EMPTY_COUNT, LAST_FROM_END, MS_PER_SECOND } from "#src/constants.js";
import { appendTurn, listMembersByIds, trimIfClosed } from "#src/db/store.js";

import type { PersistedConversation } from "./apply.js";
import type {
  ConversationCompleteInput,
  ConversationModel,
  ConversationTurn,
  ReplyMark,
  SpeakerIdentity,
} from "./types.js";

import { endCompletion, tryBeginCompletion } from "./inflight.js";
import { replyMark, speakerHandle } from "./label.js";
import { logCompletionAttempt } from "./log.js";
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

function isPendingTurn(work: ConversationWork): work is PendingTurn {
  return work.type === "pending-turn";
}

function completionPostedAt(): Date {
  return new Date(Math.floor(Date.now() / MS_PER_SECOND) * MS_PER_SECOND);
}

function wakeReply(pending: PendingTurn): ReplyMark {
  const last = pending.history.at(LAST_FROM_END);
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

async function persistAssistantAndReply(
  db: BotDatabase,
  conversationId: string,
  text: string,
  reply: ReplyMark,
): Promise<HandlerResult> {
  await persistAssistantTurn(db, conversationId, text, reply);
  return { kind: "reply", text, type: "conversation" };
}

function replyFromText(
  db: BotDatabase,
  pending: PendingTurn,
  text: string,
): Promise<HandlerResult> {
  if (text === "") {
    return Promise.resolve(CONVERSATION_SILENCE);
  }
  return persistAssistantAndReply(db, pending.conversationId, text, wakeReply(pending));
}

function memberTurnId(turn: ConversationTurn): number | null {
  if (turn.role !== "member") {
    return null;
  }
  return turn.memberId;
}

function rememberSpeakerId(ids: number[], seen: Set<number>, memberId: number | null): void {
  if (memberId === null || seen.has(memberId)) {
    return;
  }
  seen.add(memberId);
  ids.push(memberId);
}

function firstSpeakerIds(turns: ConversationTurn[]): number[] {
  const ids: number[] = [];
  const seen = new Set<number>();
  for (const turn of turns) {
    rememberSpeakerId(ids, seen, memberTurnId(turn));
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
  if (ids.length === EMPTY_COUNT) {
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
    now: pending.now,
    speakers: await speakersForTurns(db, pending.history),
    turns: pending.history,
  };
}

async function runCompletion(
  db: BotDatabase,
  model: ConversationModel,
  pending: PendingTurn,
): Promise<HandlerResult> {
  try {
    const reply = await model.complete(await completeInput(db, pending));
    return await replyFromText(db, pending, reply);
  } catch {
    return CONVERSATION_SILENCE;
  }
}

async function finishCompletion(
  db: BotDatabase,
  model: ConversationModel,
  pending: PendingTurn,
): Promise<HandlerResult> {
  try {
    return await runCompletion(db, model, pending);
  } finally {
    endCompletion(pending.conversationId, pending.memberId);
  }
}

async function skipInFlight(db: BotDatabase, pending: PendingTurn): Promise<HandlerResult> {
  logCompletionAttempt({
    completion: null,
    filters: ["in-flight"],
    prompt: conversationMessages(await completeInput(db, pending)),
  });
  return CONVERSATION_SILENCE;
}

function completePendingTurn(
  db: BotDatabase,
  model: ConversationModel,
  pending: PendingTurn,
): Promise<HandlerResult> {
  if (!tryBeginCompletion(pending.conversationId, pending.memberId)) {
    return skipInFlight(db, pending);
  }
  return finishCompletion(db, model, pending);
}

function finishConversationWork(
  db: BotDatabase,
  model: ConversationModel,
  work: ConversationWork,
): Promise<HandlerResult> {
  if (isPendingTurn(work)) {
    return completePendingTurn(db, model, work);
  }
  return Promise.resolve(work);
}

export { conversationWork, finishConversationWork, type ConversationWork };
