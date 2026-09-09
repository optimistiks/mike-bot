import type { ConversationTurn, PromptMessage } from "./types.js";

import { relativePastLabel } from "./age.js";
import { SELF_LABEL, promptLine } from "./transcript.js";

function timeBracket(postedAt: Date, now: Date): string {
  return `[${relativePastLabel(postedAt, now)}]`;
}

function speakerFor(turn: ConversationTurn): string {
  if (turn.role === "assistant") {
    return SELF_LABEL;
  }
  return turn.label;
}

function liveMessage(turn: ConversationTurn, now: Date): PromptMessage {
  const content = promptLine(speakerFor(turn), timeBracket(turn.postedAt, now), turn.text, turn.reply);
  if (turn.role === "assistant") {
    return { content, role: "assistant" };
  }
  return { content, role: "user" };
}

function liveMessages(turns: ConversationTurn[], now: Date): PromptMessage[] {
  return turns.map((turn) => liveMessage(turn, now));
}

export { liveMessages };
