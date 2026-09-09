import { captureException, flush, setConversationId, setUser, startSpan } from "@sentry/core";

import type { ConversationCompleteInput } from "./types.js";

const SENTRY_FLUSH_MS = 2000;

function bindConversation(input: ConversationCompleteInput): void {
  setConversationId(input.conversationId);
  setUser({ id: String(input.memberId) });
}

function reportCompletionFailure(error: unknown, signal: AbortSignal): void {
  captureException(error, {
    tags: { conversation_failure: signal.aborted ? "timeout" : "error" },
  });
}

function reportEmptyCompletion(): void {
  captureException(new Error("conversation completion empty"), {
    tags: { conversation_failure: "empty" },
  });
}

function reportUnhandledFailure(error: unknown): void {
  captureException(error);
}

function flushConversationTelemetry(): Promise<boolean> {
  return flush(SENTRY_FLUSH_MS);
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

export {
  bindConversation,
  flushConversationTelemetry,
  invokeAgent,
  reportCompletionFailure,
  reportEmptyCompletion,
  reportUnhandledFailure,
};
