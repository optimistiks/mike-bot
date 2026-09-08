import { AsyncLocalStorage } from "node:async_hooks";

import { EMPTY_COUNT, SINGLE_COUNT } from "#src/constants.js";

import type { ConversationCompleteInput, PromptMessage } from "./types.js";

import { absolutePostedAtLabel } from "./age.js";
import { conversationMessages, sentryConversationMessages } from "./prompt.js";

const RELATIVE_TIME_BRACKET = /^(?<prefix>\[[^\]]+\])\[\d+ (?:сек\.|мин\.|ч|дн\.) назад\]/u;

const INPUT_KEYS = [
  "ai.prompt",
  "ai.prompt.messages",
  "gen_ai.input.messages",
  "vercel.ai.prompt",
  "vercel.ai.prompt.messages",
] as const;

const OUTPUT_KEYS = [
  "ai.response.text",
  "gen_ai.output.messages",
  "vercel.ai.response.text",
] as const;

interface SentryTranscript {
  outputStamp: string;
  replacements: Record<string, string>;
}

interface SentrySpanBag {
  attributes?: Record<string, unknown>;
  data?: Record<string, unknown>;
  setAttribute?: (key: string, value: string) => void;
}

interface AttributeWriter {
  setAttribute: (key: string, value: string) => void;
}

const sentryTranscript = new AsyncLocalStorage<SentryTranscript>();

function rememberReplacement(
  replacements: Record<string, string>,
  relative: PromptMessage,
  absolute: PromptMessage,
): void {
  if (relative.content === absolute.content) {
    return;
  }
  replacements[relative.content] = absolute.content;
}

function addReplacement(
  replacements: Record<string, string>,
  relative: PromptMessage | undefined,
  absolute: PromptMessage | undefined,
): void {
  if (relative === undefined || absolute === undefined) {
    return;
  }
  rememberReplacement(replacements, relative, absolute);
}

function replacementRecord(
  relative: PromptMessage[],
  absolute: PromptMessage[],
): Record<string, string> {
  const replacements: Record<string, string> = {};
  const limit = Math.min(relative.length, absolute.length);
  for (let index = EMPTY_COUNT; index < limit; index += SINGLE_COUNT) {
    addReplacement(replacements, relative[index], absolute[index]);
  }
  return replacements;
}

function sentryTranscriptFor(input: ConversationCompleteInput): SentryTranscript {
  return {
    outputStamp: absolutePostedAtLabel(input.now),
    replacements: replacementRecord(conversationMessages(input), sentryConversationMessages(input)),
  };
}

function currentSentryTranscript(): SentryTranscript | undefined {
  return sentryTranscript.getStore();
}

function withSentryTranscript<Result>(
  input: ConversationCompleteInput,
  work: () => Result,
): Result {
  return sentryTranscript.run(sentryTranscriptFor(input), work);
}

function rewrittenText(raw: string, rewrite: (value: unknown) => unknown): string {
  const next = rewrite(raw);
  if (typeof next === "string") {
    return next;
  }
  return raw;
}

function rewriteJsonOrText(raw: string, rewrite: (value: unknown) => unknown): string {
  try {
    return JSON.stringify(rewrite(JSON.parse(raw)));
  } catch {
    return rewrittenText(raw, rewrite);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object";
}

function rewriteRecord(
  value: Record<string, unknown>,
  rewrite: (entry: unknown) => unknown,
): Record<string, unknown> {
  const next: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value)) {
    next[key] = rewrite(entry);
  }
  return next;
}

function rewriteNested(value: unknown, rewrite: (entry: unknown) => unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => rewrite(entry));
  }
  if (isRecord(value)) {
    return rewriteRecord(value, rewrite);
  }
  return value;
}

function rewriteJsonValue(value: unknown, replacements: Record<string, string>): unknown {
  if (typeof value === "string") {
    return replacements[value] ?? value;
  }
  return rewriteNested(value, (entry) => rewriteJsonValue(entry, replacements));
}

function stampTimeBracket(text: string, stamp: string): string {
  return text.replace(RELATIVE_TIME_BRACKET, `$<prefix>[${stamp}]`);
}

function stampOutputText(text: string, transcript: SentryTranscript): string {
  const replaced = transcript.replacements[text] ?? text;
  return stampTimeBracket(replaced, transcript.outputStamp);
}

function stampJsonValue(value: unknown, transcript: SentryTranscript): unknown {
  if (typeof value === "string") {
    return stampOutputText(value, transcript);
  }
  return rewriteNested(value, (entry) => stampJsonValue(entry, transcript));
}

function rewriteInputValue(raw: string, transcript: SentryTranscript): string {
  return rewriteJsonOrText(raw, (value) => rewriteJsonValue(value, transcript.replacements));
}

function rewriteOutputValue(raw: string, transcript: SentryTranscript): string {
  return rewriteJsonOrText(raw, (value) => stampJsonValue(value, transcript));
}

function rewriteKey(
  bag: Record<string, unknown>,
  key: string,
  transcript: SentryTranscript,
  rewrite: (raw: string, transcript: SentryTranscript) => string,
): void {
  const value = bag[key];
  if (typeof value !== "string") {
    return;
  }
  bag[key] = rewrite(value, transcript);
}

function rewriteKeys(
  bag: Record<string, unknown>,
  keys: readonly string[],
  transcript: SentryTranscript,
  rewrite: (raw: string, transcript: SentryTranscript) => string,
): void {
  for (const key of keys) {
    rewriteKey(bag, key, transcript, rewrite);
  }
}

function rewriteSpanBag(
  bag: Record<string, unknown> | undefined,
  transcript: SentryTranscript,
): void {
  if (bag === undefined) {
    return;
  }
  rewriteKeys(bag, INPUT_KEYS, transcript, rewriteInputValue);
  rewriteKeys(bag, OUTPUT_KEYS, transcript, rewriteOutputValue);
}

function writeAttribute(span: AttributeWriter, bag: Record<string, unknown>, key: string): void {
  const value = bag[key];
  if (typeof value === "string") {
    span.setAttribute(key, value);
  }
}

function writeAttributes(
  span: AttributeWriter,
  bag: Record<string, unknown>,
  keys: readonly string[],
): void {
  for (const key of keys) {
    writeAttribute(span, bag, key);
  }
}

function writerFrom(span: SentrySpanBag): AttributeWriter | undefined {
  if (span.setAttribute === undefined) {
    return undefined;
  }
  return { setAttribute: span.setAttribute };
}

function syncWriter(span: SentrySpanBag, bag: Record<string, unknown> | undefined): void {
  const writer = writerFrom(span);
  if (writer === undefined || bag === undefined) {
    return;
  }
  writeAttributes(writer, bag, INPUT_KEYS);
  writeAttributes(writer, bag, OUTPUT_KEYS);
}

function applySentryTranscript<SpanBag extends SentrySpanBag>(
  span: SpanBag,
  transcript: SentryTranscript,
): SpanBag {
  rewriteSpanBag(span.data, transcript);
  rewriteSpanBag(span.attributes, transcript);
  syncWriter(span, span.data);
  syncWriter(span, span.attributes);
  return span;
}

function rewriteSentryAiSpan<SpanBag extends SentrySpanBag>(span: SpanBag): SpanBag {
  const transcript = currentSentryTranscript();
  if (transcript === undefined) {
    return span;
  }
  return applySentryTranscript(span, transcript);
}

export { applySentryTranscript, rewriteSentryAiSpan, sentryTranscriptFor, withSentryTranscript };
export type { SentrySpanBag, SentryTranscript };
