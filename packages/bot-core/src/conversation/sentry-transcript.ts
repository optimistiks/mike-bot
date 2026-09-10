import { stampRelativeAgeLabels } from "./age.js";

const MESSAGE_KEYS = [
  "ai.prompt.messages",
  "gen_ai.input.messages",
  "gen_ai.output.messages",
  "gen_ai.request.messages",
] as const;

interface TranscriptSpan {
  data?: Record<string, unknown>;
  start_timestamp?: number;
}

function stampSentrySpanTranscript<Span extends TranscriptSpan>(span: Span): Span {
  const bag = span.data;
  if (bag === undefined) {
    return span;
  }
  const now =
    typeof span.start_timestamp === "number" ? new Date(span.start_timestamp * 1000) : new Date();
  for (const key of MESSAGE_KEYS) {
    const value = bag[key];
    if (typeof value === "string") {
      bag[key] = stampRelativeAgeLabels(value, now);
    }
  }
  return span;
}

export { stampSentrySpanTranscript };
export type { TranscriptSpan };
