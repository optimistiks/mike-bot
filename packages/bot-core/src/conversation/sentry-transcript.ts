import { AsyncLocalStorage } from "node:async_hooks";

import { absolutePostedAtLabel } from "./age.js";

const CURRENT_AGE = /\[0 сек\. назад\]/gu;
const INPUT_KEY = "gen_ai.input.messages";
const OUTPUT_KEY = "gen_ai.output.messages";

interface SentrySpanBag {
  attributes?: Record<string, unknown>;
  data?: Record<string, unknown>;
}

const sentryStamp = new AsyncLocalStorage<string>();

function withSentryTranscript<Result>(now: Date, work: () => Result): Result {
  return sentryStamp.run(absolutePostedAtLabel(now), work);
}

function stampKey(bag: Record<string, unknown>, key: string, iso: string): void {
  const value = bag[key];
  if (typeof value !== "string") {
    return;
  }
  bag[key] = value.replace(CURRENT_AGE, `[${iso}]`);
}

function stampBag(bag: Record<string, unknown> | undefined, iso: string): void {
  if (bag === undefined) {
    return;
  }
  stampKey(bag, INPUT_KEY, iso);
  stampKey(bag, OUTPUT_KEY, iso);
}

function rewriteSentryAiSpan<SpanBag extends SentrySpanBag>(span: SpanBag): SpanBag {
  const iso = sentryStamp.getStore();
  if (iso === undefined) {
    return span;
  }
  stampBag(span.data, iso);
  stampBag(span.attributes, iso);
  return span;
}

export { rewriteSentryAiSpan, withSentryTranscript };
export type { SentrySpanBag };
