import { EMPTY_COUNT } from "#src/constants.js";

import type { ConversationTurn, PromptMessage } from "./types.js";

import { relativePastLabel } from "./age.js";
import { SELF_LABEL, promptLine } from "./transcript.js";

const MAX_HISTORY_CHARS = 80_000;
const HISTORY_DROP_BLOCK_CHARS = 20_000;

type TimeLabel = (postedAt: Date, now: Date) => string;

function timeBracket(postedAt: Date, now: Date, timeLabel: TimeLabel): string {
  return `[${timeLabel(postedAt, now)}]`;
}

function speakerFor(turn: ConversationTurn): string {
  if (turn.role === "assistant") {
    return SELF_LABEL;
  }
  return turn.label;
}

function promptText(
  turn: ConversationTurn,
  now: Date,
  timeLabel: TimeLabel = relativePastLabel,
): string {
  return promptLine(
    speakerFor(turn),
    timeBracket(turn.postedAt, now, timeLabel),
    turn.text,
    turn.reply,
  );
}

function liveMessage(turn: ConversationTurn, now: Date, timeLabel: TimeLabel): PromptMessage {
  if (turn.role === "assistant") {
    return { content: promptText(turn, now, timeLabel), role: "assistant" };
  }
  return { content: promptText(turn, now, timeLabel), role: "user" };
}

function serializedLength(turns: ConversationTurn[], now: Date): number {
  return turns.reduce((sum, turn) => sum + promptText(turn, now).length, EMPTY_COUNT);
}

function dropOldestTurn(kept: ConversationTurn[], now: Date): number {
  const oldest = kept.shift();
  if (oldest === undefined) {
    return EMPTY_COUNT;
  }
  return promptText(oldest, now).length;
}

function dropOldestBlock(kept: ConversationTurn[], now: Date): void {
  let dropped = EMPTY_COUNT;
  while (kept.length > EMPTY_COUNT && dropped < HISTORY_DROP_BLOCK_CHARS) {
    dropped += dropOldestTurn(kept, now);
  }
}

function trimTurnsForContext(turns: ConversationTurn[], now: Date): ConversationTurn[] {
  const kept = [...turns];
  while (serializedLength(kept, now) > MAX_HISTORY_CHARS && kept.length > EMPTY_COUNT) {
    dropOldestBlock(kept, now);
  }
  return kept;
}

function liveMessages(
  turns: ConversationTurn[],
  now: Date,
  timeLabel: TimeLabel = relativePastLabel,
): PromptMessage[] {
  return trimTurnsForContext(turns, now).map((turn) => liveMessage(turn, now, timeLabel));
}

export { liveMessages, promptText, trimTurnsForContext };
