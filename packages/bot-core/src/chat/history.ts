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

function liveMessageIds(turns: readonly ChatTurn[]): Set<number> {
  return new Set(turns.map((turn) => turn.messageId));
}

function replyIsInWindow(reply: ChatTurn["reply"], ids: Set<number>): boolean {
  if (reply === null) {
    return false;
  }
  return ids.has(reply.targetMessageId);
}

function liveMessage(turn: ChatTurn, now: Date, ids: Set<number>): PromptMessage {
  const content = promptLine(
    speakerFor(turn),
    timeBracket(turn.postedAt, now),
    turn.text,
    turn.reply,
    replyIsInWindow(turn.reply, ids),
  );
  if (turn.role === "assistant") {
    return { content, role: "assistant" };
  }
  return { content, role: "user" };
}

function liveMessages(turns: ChatTurn[], now: Date): PromptMessage[] {
  const ids = liveMessageIds(turns);
  return turns.map((turn) => liveMessage(turn, now, ids));
}

export { liveMessages };
