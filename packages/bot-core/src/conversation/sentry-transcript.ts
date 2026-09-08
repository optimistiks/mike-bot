import { AsyncLocalStorage } from "node:async_hooks";

import type { ConversationCompleteInput } from "./types.js";

import { absolutePostedAtLabel } from "./age.js";
import { sentryConversationMessages } from "./prompt.js";

const RELATIVE_TIME = /\[\d+ (?:сек\.|мин\.|ч|дн\.) назад\]/gu;
const INPUT_KEY = "gen_ai.input.messages";
const OUTPUT_KEY = "gen_ai.output.messages";

interface SentryTranscript {
  input: string;
  outputStamp: string;
}

interface SentrySpanBag {
  attributes?: Record<string, unknown>;
  data?: Record<string, unknown>;
}

const sentryTranscript = new AsyncLocalStorage<SentryTranscript>();

function withSentryTranscript<Result>(
  input: ConversationCompleteInput,
  work: () => Result,
): Result {
  return sentryTranscript.run(
    {
      input: JSON.stringify(sentryConversationMessages(input)),
      outputStamp: absolutePostedAtLabel(input.now),
    },
    work,
  );
}

function overwriteInput(bag: Record<string, unknown> | undefined, input: string): void {
  if (bag === undefined || typeof bag[INPUT_KEY] !== "string") {
    return;
  }
  bag[INPUT_KEY] = input;
}

function stampOutput(bag: Record<string, unknown> | undefined, stamp: string): void {
  if (bag === undefined || typeof bag[OUTPUT_KEY] !== "string") {
    return;
  }
  bag[OUTPUT_KEY] = bag[OUTPUT_KEY].replace(RELATIVE_TIME, `[${stamp}]`);
}

function rewriteSentryAiSpan<SpanBag extends SentrySpanBag>(span: SpanBag): SpanBag {
  const transcript = sentryTranscript.getStore();
  if (transcript === undefined) {
    return span;
  }
  overwriteInput(span.data, transcript.input);
  overwriteInput(span.attributes, transcript.input);
  stampOutput(span.data, transcript.outputStamp);
  stampOutput(span.attributes, transcript.outputStamp);
  return span;
}

export { rewriteSentryAiSpan, withSentryTranscript };
export type { SentrySpanBag };
