import type { Span } from "@sentry/core";

import {
  captureException,
  getClient,
  setConversationId,
  setUser,
  spanToJSON,
  startSpan,
} from "@sentry/core";

import type { SentrySpanBag } from "./sentry-transcript.js";
import type { ConversationCompleteInput } from "./types.js";

import { rewriteSentryAiSpan } from "./sentry-transcript.js";

let processSpanHooked = false;

function onSentrySpanStart(span: Span): void {
  rewriteSentryAiSpan({
    data: spanToJSON(span).data,
    setAttribute: (key, value) => {
      span.setAttribute(key, value);
    },
  });
}

function onSentryProcessSpan(span: SentrySpanBag): void {
  rewriteSentryAiSpan(span);
}

function listenForSentrySpans(client: NonNullable<ReturnType<typeof getClient>>): void {
  client.on("spanStart", onSentrySpanStart);
  client.on("processSpan", onSentryProcessSpan);
}

function hookSentryTranscriptRewrite(): void {
  if (processSpanHooked) {
    return;
  }
  const client = getClient();
  if (client === undefined) {
    return;
  }
  processSpanHooked = true;
  listenForSentrySpans(client);
}

function bindConversation(input: ConversationCompleteInput): void {
  hookSentryTranscriptRewrite();
  setConversationId(input.conversationId);
  setUser({ id: String(input.memberId) });
}

function failureKind(signal: AbortSignal): string {
  if (signal.aborted) {
    return "timeout";
  }
  return "error";
}

function reportCompletionFailure(error: unknown, signal: AbortSignal): void {
  captureException(error, {
    tags: { conversation_failure: failureKind(signal) },
  });
}

function reportUnhandledFailure(error: unknown): void {
  captureException(error);
}

function invokeAgent<Result>(model: string, work: () => Result): Result {
  return startSpan(
    {
      attributes: {
        "gen_ai.agent.name": "mike",
        "gen_ai.operation.name": "invoke_agent",
        "gen_ai.request.model": model,
      },
      name: "invoke_agent mike",
      op: "gen_ai.invoke_agent",
    },
    work,
  );
}

export { bindConversation, invokeAgent, reportCompletionFailure, reportUnhandledFailure };
