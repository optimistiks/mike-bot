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

type ChatTool = "contents" | "search" | "weather";
type ToolFailure = "config" | "http" | "network" | "parse";

interface ToolFailureReport {
  cause?: unknown;
  kind: ToolFailure;
  status?: number;
  tool: ChatTool;
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

function toolFailureMessage(report: ToolFailureReport): string {
  if (report.kind === "http" && report.status !== undefined) {
    return `${report.tool} http ${String(report.status)}`;
  }
  return `${report.tool} ${report.kind}`;
}

function reportToolFailure(report: ToolFailureReport): void {
  const error =
    report.cause === undefined
      ? new Error(toolFailureMessage(report))
      : new Error(toolFailureMessage(report), { cause: report.cause });
  captureException(error, {
    tags: { tool: report.tool, tool_failure: report.kind },
  });
}

function reportCaughtToolFailure(tool: ChatTool, kind: "network" | "parse", error: unknown): void {
  if (!isAbortError(error)) {
    reportToolFailure({ cause: error, kind, tool });
  }
}

type ToolJsonRead = { data: unknown; ok: true } | { error: string; ok: false };

async function readToolJson(
  tool: ChatTool,
  miss: string,
  work: () => Promise<Response>,
): Promise<ToolJsonRead> {
  try {
    const response = await work();
    if (!response.ok) {
      reportToolFailure({ kind: "http", status: response.status, tool });
      return { error: miss, ok: false };
    }
    try {
      return { data: await response.json(), ok: true };
    } catch (error) {
      reportCaughtToolFailure(tool, "parse", error);
      return { error: miss, ok: false };
    }
  } catch (error) {
    reportCaughtToolFailure(tool, "network", error);
    return { error: miss, ok: false };
  }
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
  readToolJson,
  reportCompletionFailure,
  reportEmptyCompletion,
  reportToolFailure,
  reportUnhandledFailure,
};
