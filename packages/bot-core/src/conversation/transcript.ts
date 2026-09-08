import type { ReplyMark } from "./types.js";

const SELF_LABEL = "Ты";

function nameBracket(speaker: string, reply: ReplyMark | null): string {
  if (reply === null) {
    return `[${speaker}]`;
  }
  return `[${speaker} → ${reply.targetLabel}]`;
}

function quoteBracket(reply: ReplyMark | null): string {
  if (reply === null || reply.quote === null) {
    return "";
  }
  return `[на "${reply.quote}"]`;
}

function promptLine(
  speaker: string,
  timeBracket: string,
  text: string,
  reply: ReplyMark | null,
): string {
  return `${nameBracket(speaker, reply)}${timeBracket}${quoteBracket(reply)} ${text}`;
}

export { SELF_LABEL, promptLine };
