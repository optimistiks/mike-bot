import type { ChatTurn, PromptMessage } from "./types.js";

import { relativePastLabel } from "./age.js";
import { SELF_LABEL, promptLine } from "./transcript.js";

function timeBracket(postedAt: Date, now: Date): string {
  return `[${relativePastLabel(postedAt, now)}]`;
}

function speakerFor(turn: ChatTurn): string {
  if (turn.role === "assistant") {
    return SELF_LABEL;
  }
  return turn.label;
}

function liveMessage(turn: ChatTurn, now: Date): PromptMessage {
  const content = promptLine(
    speakerFor(turn),
    timeBracket(turn.postedAt, now),
    turn.text,
    turn.reply,
  );
  if (turn.role === "assistant") {
    return { content, role: "assistant" };
  }
  return { content, role: "user" };
}

function liveMessages(turns: ChatTurn[], now: Date): PromptMessage[] {
  return turns.map((turn) => liveMessage(turn, now));
}

export { liveMessages };
