import { generateText } from "ai";

import { EMPTY_COUNT, SINGLE_COUNT } from "#src/constants.js";

import type { ConversationCompleteInput, ConversationModel, PromptMessage } from "./types.js";

import { cutBanned, hasBannedPhrase, isBlank, postProcess } from "./filter.js";
import { logCompletionAttempt } from "./log.js";
import { bindConversation, invokeAgent, reportCompletionFailure } from "./observability.js";
import { CONVERSATION_SYSTEM_PROMPT, conversationMessages } from "./prompt.js";
import { withSentryTranscript } from "./sentry-transcript.js";

const CONVERSATION_MODEL = "zai/glm-5.3-flash";
const COMPLETE_TIMEOUT_MS = 8000;
const MAX_BANNED_RETRIES = 2;
const MAX_OUTPUT_TOKENS = 100;
const STOP_SEQUENCES = ["\n\n", "\n["];
const TEMPERATURE = 1;
const COMPLETION_TELEMETRY = {
  functionId: "conversation-complete",
  isEnabled: true,
  recordInputs: true,
  recordOutputs: true,
} as const;

interface SampleState {
  retries: number;
  sample: string;
}

function retryFilters(retries: number): string[] {
  if (retries > EMPTY_COUNT) {
    return ["retry"];
  }
  return [];
}

function abortFilters(signal: AbortSignal): string[] {
  if (signal.aborted) {
    return ["timeout"];
  }
  return [];
}

async function generateSample(messages: PromptMessage[], signal: AbortSignal): Promise<string> {
  const { text } = await generateText({
    abortSignal: signal,
    allowSystemInMessages: true,
    instructions: CONVERSATION_SYSTEM_PROMPT,
    maxOutputTokens: MAX_OUTPUT_TOKENS,
    maxRetries: 0,
    messages,
    model: CONVERSATION_MODEL,
    reasoning: "none",
    stopSequences: STOP_SEQUENCES,
    telemetry: COMPLETION_TELEMETRY,
    temperature: TEMPERATURE,
  });
  return text;
}

function finishSample(messages: PromptMessage[], sample: string, priorFilters: string[]): string {
  const processed = postProcess(sample);
  logCompletionAttempt({
    completion: sample,
    filters: [...priorFilters, ...processed.filters],
    prompt: messages,
  });
  return processed.text;
}

function finishCut(messages: PromptMessage[], sample: string, retries: number): string {
  const cut = cutBanned(sample);
  const prior = [...retryFilters(retries), "banned-phrase", "truncate-banned"];
  if (isBlank(cut)) {
    logCompletionAttempt({
      completion: sample,
      filters: [...prior, "empty"],
      prompt: messages,
    });
    return "";
  }
  return finishSample(messages, cut, prior);
}

function shouldStopRetrying(sample: string, retries: number): boolean {
  if (isBlank(sample)) {
    return true;
  }
  if (!hasBannedPhrase(sample)) {
    return true;
  }
  return retries >= MAX_BANNED_RETRIES;
}

function logBannedAttempt(messages: PromptMessage[], state: SampleState): void {
  logCompletionAttempt({
    completion: state.sample,
    filters: [...retryFilters(state.retries), "banned-phrase"],
    prompt: messages,
  });
}

async function skipBanned(
  messages: PromptMessage[],
  signal: AbortSignal,
  state: SampleState,
): Promise<SampleState> {
  if (shouldStopRetrying(state.sample, state.retries)) {
    return state;
  }
  logBannedAttempt(messages, state);
  return skipBanned(messages, signal, {
    retries: state.retries + SINGLE_COUNT,
    sample: await generateSample(messages, signal),
  });
}

function finalizeNonEmpty(messages: PromptMessage[], state: SampleState): string {
  if (!hasBannedPhrase(state.sample)) {
    return finishSample(messages, state.sample, retryFilters(state.retries));
  }
  return finishCut(messages, state.sample, state.retries);
}

function finalizeSample(messages: PromptMessage[], state: SampleState): string {
  if (isBlank(state.sample)) {
    logCompletionAttempt({ completion: state.sample, filters: ["empty"], prompt: messages });
    return "";
  }
  return finalizeNonEmpty(messages, state);
}

async function sampleUntilClean(messages: PromptMessage[], signal: AbortSignal): Promise<string> {
  const state = await skipBanned(messages, signal, {
    retries: EMPTY_COUNT,
    sample: await generateSample(messages, signal),
  });
  return finalizeSample(messages, state);
}

function failCompletion(messages: PromptMessage[], signal: AbortSignal, error: unknown): string {
  reportCompletionFailure(error, signal);
  logCompletionAttempt({
    completion: null,
    filters: abortFilters(signal),
    prompt: messages,
  });
  return "";
}

async function completeWithSignal(
  input: ConversationCompleteInput,
  signal: AbortSignal,
): Promise<string> {
  const messages = conversationMessages(input);
  try {
    return await sampleUntilClean(messages, signal);
  } catch (error) {
    return failCompletion(messages, signal, error);
  }
}

async function completeWithTimeout(input: ConversationCompleteInput): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort();
  }, COMPLETE_TIMEOUT_MS);
  try {
    return await completeWithSignal(input, controller.signal);
  } finally {
    clearTimeout(timer);
  }
}

function complete(input: ConversationCompleteInput): Promise<string> {
  bindConversation(input);
  return withSentryTranscript(input.now, () =>
    invokeAgent(CONVERSATION_MODEL, () => completeWithTimeout(input)),
  );
}

const gatewayConversationModel: ConversationModel = {
  complete,
};

export { COMPLETE_TIMEOUT_MS, CONVERSATION_MODEL, gatewayConversationModel };
