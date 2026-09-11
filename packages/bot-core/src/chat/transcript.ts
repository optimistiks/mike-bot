import type { ReplyMark } from "./types.js";

import { stripBrackets } from "./quote.js";

const SELF_LABEL = "Ты";

const MOSCOW_ABSOLUTE = new Intl.DateTimeFormat("ru", {
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  month: "long",
  timeZone: "Europe/Moscow",
});

function quotedLines(quote: string): string {
  return quote
    .split("\n")
    .map((line) => `> ${line}`)
    .join("\n");
}

function absoluteWhen(postedAt: Date | null): string {
  if (postedAt === null) {
    return "";
  }
  return ` от ${MOSCOW_ABSOLUTE.format(postedAt)}`;
}

function replyClause(reply: ReplyMark, inWindow: boolean): string {
  if (inWindow) {
    return ` в ответ ${reply.targetLabel}`;
  }
  return ` в ответ ${reply.targetLabel}${absoluteWhen(reply.targetPostedAt)}`;
}

function replicaHeader(speaker: string, timeBracket: string, replyTail: string): string {
  return `[${speaker}]${timeBracket}${replyTail}:`;
}

function withSingleLineBody(header: string, body: string): string {
  if (body.includes("\n")) {
    return `${header}\n${body}`;
  }
  return `${header} ${body}`;
}

function withQuotedOriginal(header: string, quote: string, body: string): string {
  return `${header}\n${quotedLines(quote)}\n\n${body}`;
}

function replicaBody(
  header: string,
  body: string,
  quote: string | null,
  inWindow: boolean,
): string {
  if (!inWindow && quote !== null) {
    return withQuotedOriginal(header, quote, body);
  }
  return withSingleLineBody(header, body);
}

function promptLine(
  speaker: string,
  timeBracket: string,
  text: string,
  reply: ReplyMark | null,
  inWindow: boolean,
): string {
  const body = stripBrackets(text);
  if (reply === null) {
    return replicaBody(replicaHeader(speaker, timeBracket, ""), body, null, true);
  }
  return replicaBody(
    replicaHeader(speaker, timeBracket, replyClause(reply, inWindow)),
    body,
    reply.quote,
    inWindow,
  );
}

export { SELF_LABEL, promptLine };
