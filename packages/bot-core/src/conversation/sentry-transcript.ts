import { defineIntegration, spanToJSON } from "@sentry/core";
import { AsyncLocalStorage } from "node:async_hooks";

import type { ConversationCompleteInput, ConversationTurn } from "./types.js";

import { absolutePostedAtLabel, relativePastLabel } from "./age.js";

const AGE_ATTR = "mike.transcript.age";
const ISO_ATTR = "mike.transcript.iso";
const INPUT_KEYS = [
  "ai.prompt.messages",
  "gen_ai.input.messages",
  "gen_ai.request.messages",
] as const;

interface TranscriptStamp {
  age: string;
  iso: string;
}

interface SentrySpanBag {
  attributes?: Record<string, unknown>;
  data?: Record<string, unknown>;
  setAttribute?: (key: string, value: string) => unknown;
}

const transcriptStamp = new AsyncLocalStorage<TranscriptStamp>();

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isMemberTurn(
  turn: ConversationTurn,
): turn is Extract<ConversationTurn, { role: "member" }> {
  return turn.role === "member";
}

function lastMemberTurn(
  turns: readonly ConversationTurn[],
): Extract<ConversationTurn, { role: "member" }> | undefined {
  return turns.findLast((turn) => isMemberTurn(turn));
}

function transcriptStampFrom(input: ConversationCompleteInput): TranscriptStamp | undefined {
  const last = lastMemberTurn(input.turns);
  if (last === undefined) {
    return undefined;
  }
  return {
    age: relativePastLabel(last.postedAt, input.now),
    iso: absolutePostedAtLabel(last.postedAt),
  };
}

function withSentryTranscript<Result>(
  stamp: TranscriptStamp | undefined,
  work: () => Result,
): Result {
  if (stamp === undefined) {
    return work();
  }
  return transcriptStamp.run(stamp, work);
}

function parseMessages(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function replaceAgeBracket(content: string, age: string, iso: string): string {
  const from = `[${age}]`;
  const index = content.indexOf(from);
  if (index === -1) {
    return content;
  }
  return `${content.slice(0, index)}[${iso}]${content.slice(index + from.length)}`;
}

function stampText(
  content: string,
  stamp: TranscriptStamp,
): { content: string; replaced: boolean } {
  const next = replaceAgeBracket(content, stamp.age, stamp.iso);
  return { content: next, replaced: next !== content };
}

function lastTextPart(parts: unknown[]): Record<string, unknown> | undefined {
  const texts = parts.filter(
    (part): part is Record<string, unknown> =>
      isRecord(part) && part.type === "text" && typeof part.content === "string",
  );
  return texts.at(-1);
}

function stampParts(parts: unknown, stamp: TranscriptStamp): boolean {
  if (!Array.isArray(parts)) {
    return false;
  }
  const part = lastTextPart(parts);
  if (part === undefined || typeof part.content !== "string") {
    return false;
  }
  const next = stampText(part.content, stamp);
  if (!next.replaced) {
    return false;
  }
  part.content = next.content;
  return true;
}

function stampLastUserMessage(message: Record<string, unknown>, stamp: TranscriptStamp): boolean {
  if (typeof message.content === "string") {
    const next = stampText(message.content, stamp);
    if (!next.replaced) {
      return false;
    }
    message.content = next.content;
    return true;
  }
  return stampParts(message.parts, stamp);
}

function lastUserMessage(parsed: unknown[]): Record<string, unknown> | undefined {
  const users = parsed.filter(
    (message): message is Record<string, unknown> => isRecord(message) && message.role === "user",
  );
  return users.at(-1);
}

function stampLastUserAge(raw: string, stamp: TranscriptStamp): string {
  const parsed = parseMessages(raw);
  if (!Array.isArray(parsed)) {
    return raw;
  }
  const message = lastUserMessage(parsed);
  if (message === undefined || !stampLastUserMessage(message, stamp)) {
    return raw;
  }
  return JSON.stringify(parsed);
}

function collectAttrs(span: SentrySpanBag): Record<string, unknown> {
  return { ...span.data, ...span.attributes };
}

function stringAttr(attrs: Record<string, unknown>, key: string): string | undefined {
  const value = attrs[key];
  return typeof value === "string" ? value : undefined;
}

function readStamp(span: SentrySpanBag): TranscriptStamp | undefined {
  const attrs = collectAttrs(span);
  const age = stringAttr(attrs, AGE_ATTR);
  const iso = stringAttr(attrs, ISO_ATTR);
  if (age !== undefined && iso !== undefined) {
    return { age, iso };
  }
  return transcriptStamp.getStore();
}

function writeAttr(span: SentrySpanBag, key: string, value: string): void {
  span.setAttribute?.(key, value);
  if (span.attributes !== undefined) {
    span.attributes[key] = value;
  }
  if (span.data !== undefined) {
    span.data[key] = value;
  }
}

function stampInputKeys(span: SentrySpanBag, stamp: TranscriptStamp): void {
  const attrs = collectAttrs(span);
  for (const key of INPUT_KEYS) {
    const value = stringAttr(attrs, key);
    if (value !== undefined) {
      const stamped = stampLastUserAge(value, stamp);
      if (stamped !== value) {
        writeAttr(span, key, stamped);
      }
    }
  }
}

function stampSentryTranscriptSpan(span: SentrySpanBag): void {
  const stamp = readStamp(span);
  if (stamp === undefined) {
    return;
  }
  writeAttr(span, AGE_ATTR, stamp.age);
  writeAttr(span, ISO_ATTR, stamp.iso);
  stampInputKeys(span, stamp);
}

const sentryTranscriptIntegration = defineIntegration(() => ({
  name: "MikeSentryTranscript",
  setup(client): void {
    client.on("spanStart", (span): void => {
      stampSentryTranscriptSpan({
        attributes: spanToJSON(span).data,
        setAttribute: (key, value) => span.setAttribute(key, value),
      });
    });
    client.on("processSpan", (span): void => {
      stampSentryTranscriptSpan(span);
    });
  },
}));

export {
  sentryTranscriptIntegration,
  stampSentryTranscriptSpan,
  transcriptStampFrom,
  withSentryTranscript,
};
export type { SentrySpanBag };
