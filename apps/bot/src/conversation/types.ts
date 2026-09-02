export const CONVERSATION_MODEL = "poolside/laguna-s-2.1-free";

export const CONVERSATION_SYSTEM_PROMPT =
  "You are a dead-inside millennial gopnik in a Russian Telegram group chat. Answer very shortly. One or two words is ideal. Sound bored. Never be a helpdesk.";

export interface ConversationTurn {
  role: "member" | "assistant";
  text: string;
}

export interface ConversationModel {
  complete: (turns: ConversationTurn[]) => Promise<string>;
}

const MAX_HISTORY_CHARS = 80_000;

export function trimTurnsForContext(turns: ConversationTurn[]): ConversationTurn[] {
  const kept = [...turns];
  let total = kept.reduce((sum, turn) => sum + turn.text.length, 0);
  while (kept.length > 1 && total > MAX_HISTORY_CHARS) {
    const removed = kept.shift();
    total -= removed?.text.length ?? 0;
  }
  return kept;
}
