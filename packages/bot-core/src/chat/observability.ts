import { captureException, flush, setConversationId, setUser, startSpan } from "@sentry/core";

import type { ChatCompleteInput } from "./types.js";

const SENTRY_FLUSH_MS = 2000;

function bindConversation(input: ChatCompleteInput): void {
  setConversationId(input.sentryConversationId);
  setUser({ id: String(input.memberId) });
}

function reportCompletionFailure(error: unknown, signal: AbortSignal): void {
  captureException(error, {
    tags: { chat_failure: signal.aborted ? "timeout" : "error" },
  });
}

function reportEmptyCompletion(): void {
  captureException(new Error("chat completion empty"), {
    tags: { chat_failure: "empty" },
  });
}

function reportUnhandledFailure(error: unknown): void {
  captureException(error);
}

function flushChatTelemetry(): Promise<boolean> {
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
  flushChatTelemetry,
  invokeAgent,
  reportCompletionFailure,
  reportEmptyCompletion,
  reportUnhandledFailure,
};
