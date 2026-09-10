import { generateText, isStepCount } from "ai";

import { logInfo } from "#src/log.js";

import type { SearchHit, SearchReply } from "./search.js";
import type { ChatCompleteInput, PromptMessage } from "./types.js";

import { cutBanned, hasBannedPhrase, isBlank, postProcess } from "./filter.js";
import {
  bindConversation,
  invokeAgent,
  reportCompletionFailure,
  reportEmptyCompletion,
} from "./observability.js";
import { CHAT_SYSTEM_PROMPT, chatMessages } from "./prompt.js";
import { searchHitsFromOutput, searchReply, searchTool } from "./search.js";
import { weatherTool } from "./weather.js";

const CHAT_MODEL = "zai/glm-5.3-flash";
const COMPLETE_TIMEOUT_MS = 30_000;
const MAX_BANNED_RETRIES = 2;
const MAX_OUTPUT_TOKENS = 1000;
const MAX_TOOL_STEPS = 3;
const STOP_SEQUENCES = ["\n["];
const TEMPERATURE = 1;
const COMPLETION_TELEMETRY = {
  functionId: "chat-complete",
  isEnabled: true,
  recordInputs: true,
  recordOutputs: true,
} as const;

interface Sample {
  hits: SearchHit[];
  text: string;
}

interface ChatCompletion {
  entities?: SearchReply["entities"];
  linkPreviewDisabled?: true;
  text: string;
}

const EMPTY_COMPLETION: ChatCompletion = { text: "" };

function logCompletionAttempt(entry: { completion: string | null; prompt: unknown }): void {
  logInfo(JSON.stringify(entry));
}

function lastSearchHits(
  toolResults: readonly { output: unknown; toolName: string }[],
): SearchHit[] {
  for (const result of toolResults) {
    if (result.toolName === "search") {
      const hits = searchHitsFromOutput(result.output);
      if (hits.length > 0) {
        return hits;
      }
    }
  }
  return [];
}

function asCompletion(text: string, hits: SearchHit[]): ChatCompletion {
  if (text === "") {
    return { text };
  }
  const reply = searchReply(text, hits);
  if (reply === null) {
    return { text };
  }
  return {
    entities: reply.entities,
    linkPreviewDisabled: reply.linkPreviewDisabled,
    text: reply.text,
  };
}

async function generateSample(
  messages: PromptMessage[],
  signal: AbortSignal,
  now: Date,
): Promise<Sample> {
  const { text, toolResults } = await generateText({
    abortSignal: signal,
    allowSystemInMessages: true,
    instructions: CHAT_SYSTEM_PROMPT,
    maxOutputTokens: MAX_OUTPUT_TOKENS,
    maxRetries: 0,
    messages,
    model: CHAT_MODEL,
    reasoning: "xhigh",
    stopSequences: STOP_SEQUENCES,
    stopWhen: isStepCount(MAX_TOOL_STEPS),
    telemetry: COMPLETION_TELEMETRY,
    temperature: TEMPERATURE,
    tools: { search: searchTool(now), weather: weatherTool(now) },
  });
  return { hits: lastSearchHits(toolResults), text };
}

function finishSample(messages: PromptMessage[], sample: Sample): ChatCompletion {
  const text = postProcess(sample.text);
  logCompletionAttempt({ completion: sample.text, prompt: messages });
  return asCompletion(text, sample.hits);
}

function finishCut(messages: PromptMessage[], sample: Sample): ChatCompletion {
  const cut = cutBanned(sample.text);
  if (isBlank(cut)) {
    logCompletionAttempt({ completion: sample.text, prompt: messages });
    return asCompletion("", sample.hits);
  }
  return finishSample(messages, { hits: sample.hits, text: cut });
}

async function sampleUntilClean(
  messages: PromptMessage[],
  signal: AbortSignal,
  now: Date,
): Promise<ChatCompletion> {
  let sample = await generateSample(messages, signal, now);
  let retries = 0;
  while (hasBannedPhrase(sample.text) && !isBlank(sample.text) && retries < MAX_BANNED_RETRIES) {
    logCompletionAttempt({ completion: sample.text, prompt: messages });
    retries += 1;
    // eslint-disable-next-line no-await-in-loop -- banned retries must see the previous sample
    sample = await generateSample(messages, signal, now);
  }
  if (isBlank(sample.text) && sample.hits.length === 0) {
    logCompletionAttempt({ completion: sample.text, prompt: messages });
    return EMPTY_COMPLETION;
  }
  if (hasBannedPhrase(sample.text)) {
    return finishCut(messages, sample);
  }
  return finishSample(messages, sample);
}

function failCompletion(
  messages: PromptMessage[],
  signal: AbortSignal,
  error: unknown,
): ChatCompletion {
  reportCompletionFailure(error, signal);
  logCompletionAttempt({ completion: null, prompt: messages });
  return EMPTY_COMPLETION;
}

async function completeWithTimeout(input: ChatCompleteInput): Promise<ChatCompletion> {
  const messages = chatMessages(input);
  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort();
  }, COMPLETE_TIMEOUT_MS);
  try {
    const completion = await sampleUntilClean(messages, controller.signal, input.now);
    if (completion.text === "") {
      reportEmptyCompletion();
    }
    return completion;
  } catch (error) {
    return failCompletion(messages, controller.signal, error);
  } finally {
    clearTimeout(timer);
  }
}

function complete(input: ChatCompleteInput): Promise<ChatCompletion> {
  bindConversation(input);
  return invokeAgent(CHAT_MODEL, () => completeWithTimeout(input));
}

export type { ChatCompletion };
export { complete };
