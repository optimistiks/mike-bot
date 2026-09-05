import { EMPTY_COUNT } from "#src/constants.js";

import type { ConversationTurn, PromptMessage } from "./types.js";

const MAX_HISTORY_CHARS = 80_000;
const HISTORY_DROP_BLOCK_CHARS = 20_000;

function memberPromptText(turn: Extract<ConversationTurn, { role: "member" }>): string {
  return `[${turn.label}] ${turn.text}`;
}

function promptText(turn: ConversationTurn): string {
  if (turn.role === "assistant") {
    return turn.text;
  }
  return memberPromptText(turn);
}

function liveMessage(turn: ConversationTurn): PromptMessage {
  if (turn.role === "assistant") {
    return { content: turn.text, role: "assistant" };
  }
  return { content: promptText(turn), role: "user" };
}

function serializedLength(turns: ConversationTurn[]): number {
  return turns.reduce((sum, turn) => sum + promptText(turn).length, EMPTY_COUNT);
}

function dropOldestTurn(kept: ConversationTurn[]): number {
  const oldest = kept.shift();
  if (oldest === undefined) {
    return EMPTY_COUNT;
  }
  return promptText(oldest).length;
}

function dropOldestBlock(kept: ConversationTurn[]): void {
  let dropped = EMPTY_COUNT;
  while (kept.length > EMPTY_COUNT && dropped < HISTORY_DROP_BLOCK_CHARS) {
    dropped += dropOldestTurn(kept);
  }
}

function trimTurnsForContext(turns: ConversationTurn[]): ConversationTurn[] {
  const kept = [...turns];
  while (serializedLength(kept) > MAX_HISTORY_CHARS && kept.length > EMPTY_COUNT) {
    dropOldestBlock(kept);
  }
  return kept;
}

function liveMessages(turns: ConversationTurn[]): PromptMessage[] {
  return trimTurnsForContext(turns).map((turn) => liveMessage(turn));
}

export { liveMessages, promptText, trimTurnsForContext };
