import { generateText } from "ai";

import { logInfo } from "#src/log.js";

import type { ConversationCompleteInput, PromptMessage } from "./types.js";

import { cutBanned, hasBannedPhrase, isBlank, postProcess } from "./filter.js";
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

function logCompletionAttempt(entry: { completion: string | null; prompt: unknown }): void {
  logInfo(JSON.stringify(entry));
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

function finishSample(messages: PromptMessage[], sample: string): string {
  const text = postProcess(sample);
  logCompletionAttempt({ completion: sample, prompt: messages });
  return text;
}

function finishCut(messages: PromptMessage[], sample: string): string {
  const cut = cutBanned(sample);
  if (isBlank(cut)) {
    logCompletionAttempt({ completion: sample, prompt: messages });
    return "";
  }
  return finishSample(messages, cut);
}

async function sampleUntilClean(messages: PromptMessage[], signal: AbortSignal): Promise<string> {
  let sample = await generateSample(messages, signal);
  let retries = 0;
  while (hasBannedPhrase(sample) && !isBlank(sample) && retries < MAX_BANNED_RETRIES) {
    logCompletionAttempt({ completion: sample, prompt: messages });
    retries += 1;
    // eslint-disable-next-line no-await-in-loop -- banned retries must see the previous sample
    sample = await generateSample(messages, signal);
  }
  if (isBlank(sample)) {
    logCompletionAttempt({ completion: sample, prompt: messages });
    return "";
  }
  if (hasBannedPhrase(sample)) {
    return finishCut(messages, sample);
  }
  return finishSample(messages, sample);
}

function failCompletion(messages: PromptMessage[], signal: AbortSignal, error: unknown): string {
  reportCompletionFailure(error, signal);
  logCompletionAttempt({ completion: null, prompt: messages });
  return "";
}

async function completeWithTimeout(input: ConversationCompleteInput): Promise<string> {
  const messages = conversationMessages(input);
  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort();
  }, COMPLETE_TIMEOUT_MS);
  try {
    return await sampleUntilClean(messages, controller.signal);
  } catch (error) {
    return failCompletion(messages, controller.signal, error);
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

export { complete };
