import type { BotDatabase } from "#src/db/runtime.js";
import type { HandlerResult } from "#src/outcomes.js";

import { EMPTY_COUNT } from "#src/constants.js";
import { appendTurn, listMembersByIds, trimIfClosed } from "#src/db/store.js";

import type { PersistedConversation } from "./apply.js";
import type {
  ConversationCompleteInput,
  ConversationModel,
  ConversationTurn,
  SpeakerIdentity,
} from "./types.js";

import { endCompletion, tryBeginCompletion } from "./inflight.js";
import { speakerHandle } from "./label.js";
import { logCompletionAttempt } from "./log.js";
import { conversationMessages } from "./prompt.js";

interface PendingTurn {
  type: "pending-turn";
  addresseeLabel: string;
  conversationId: string;
  history: ConversationTurn[];
  memberId: number;
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
      type: "pending-turn",
    };
  }
  return { kind: persisted.kind, type: "conversation" };
}

function isPendingTurn(work: ConversationWork): work is PendingTurn {
  return work.type === "pending-turn";
}

async function persistAssistantTurn(
  db: BotDatabase,
  conversationId: string,
  text: string,
): Promise<void> {
  await db.transaction(async (session) => {
    await appendTurn(session, conversationId, "assistant", text, null, null);
    await trimIfClosed(session, conversationId);
  });
}

async function persistAssistantAndReply(
  db: BotDatabase,
  conversationId: string,
  text: string,
): Promise<HandlerResult> {
  await persistAssistantTurn(db, conversationId, text);
  return { kind: "reply", text, type: "conversation" };
}

function replyFromText(
  db: BotDatabase,
  conversationId: string,
  text: string,
): Promise<HandlerResult> {
  if (text === "") {
    return Promise.resolve(CONVERSATION_SILENCE);
  }
  return persistAssistantAndReply(db, conversationId, text);
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
    return await replyFromText(db, pending.conversationId, reply);
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
