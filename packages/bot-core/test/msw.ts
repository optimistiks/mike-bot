import { HttpResponse, delay, http } from "msw";
import { setupServer } from "msw/node";
import { once } from "node:events";
import { z } from "zod";

import { EMPTY_COUNT, LAST_FROM_END, SINGLE_COUNT } from "#src/constants.js";

const textPartSchema = z.object({
  text: z.string(),
  type: z.literal("text"),
});

const userMessageSchema = z.object({
  content: z.array(z.unknown()),
  role: z.literal("user"),
});

const assistantPartsSchema = z.object({
  content: z.array(z.unknown()),
  role: z.literal("assistant"),
});

const assistantStringSchema = z.object({
  content: z.string(),
  role: z.literal("assistant"),
});

const bodySchema = z.object({
  prompt: z.array(z.unknown()),
});

const LIVE_LABEL = /^\[(?:alice|bob|carol)(?: → [^\]]+)?\]\[/u;
const POLL_MS = 10;

const capturedModelBodies: unknown[] = [];
const queuedTexts: string[] = [];
const holdEvents = new EventTarget();

let holdGate: Promise<undefined> | null = null;

function modelJson(text: string): ReturnType<typeof HttpResponse.json> {
  return HttpResponse.json({
    content: [{ text, type: "text" }],
    finishReason: { raw: "stop", unified: "stop" },
    usage: {
      inputTokens: {
        cacheRead: 0,
        cacheWrite: 0,
        noCache: 10,
        total: 10,
      },
      outputTokens: { reasoning: 0, text: 1, total: 1 },
    },
  });
}

async function waitIfHeld(): Promise<void> {
  if (holdGate === null) {
    return;
  }
  const gate = holdGate;
  holdGate = null;
  await gate;
}

function nextModelText(): string {
  return queuedTexts.shift() ?? "че";
}

const modelServer = setupServer(
  http.post("https://ai-gateway.vercel.sh/v4/ai/language-model", async ({ request }) => {
    const body: unknown = await request.json();
    capturedModelBodies.push(body);
    await waitIfHeld();
    return modelJson(nextModelText());
  }),
);

function resetCapturedModelBodies(): void {
  capturedModelBodies.length = EMPTY_COUNT;
  queuedTexts.length = EMPTY_COUNT;
  holdEvents.dispatchEvent(new Event("release"));
  holdGate = null;
}

function enqueueModelTexts(texts: string[]): void {
  queuedTexts.push(...texts);
}

async function waitForRelease(): Promise<undefined> {
  await once(holdEvents, "release");
  return undefined;
}

function holdNextModelResponse(): () => void {
  holdGate = waitForRelease();
  return () => {
    holdEvents.dispatchEvent(new Event("release"));
  };
}

async function waitUntilModelCallCount(count: number): Promise<void> {
  if (capturedModelBodies.length >= count) {
    return;
  }
  await delay(POLL_MS);
  return waitUntilModelCallCount(count);
}

function textFromPart(part: unknown): string[] {
  const parsed = textPartSchema.safeParse(part);
  if (!parsed.success) {
    return [];
  }
  return [parsed.data.text];
}

function userTextsFromMessage(message: unknown): string[] {
  const parsed = userMessageSchema.safeParse(message);
  if (!parsed.success) {
    return [];
  }
  return parsed.data.content.flatMap((part) => textFromPart(part));
}

function userTextsFromBody(body: unknown): string[] {
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return [];
  }
  return parsed.data.prompt.flatMap((message) => userTextsFromMessage(message));
}

function assistantTextsFromMessage(message: unknown): string[] {
  const asParts = assistantPartsSchema.safeParse(message);
  if (asParts.success) {
    return asParts.data.content.flatMap((part) => textFromPart(part));
  }
  const asString = assistantStringSchema.safeParse(message);
  if (!asString.success) {
    return [];
  }
  return [asString.data.content];
}

function assistantTurnTextsFromBody(body: unknown): string[] {
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return [];
  }
  return parsed.data.prompt.flatMap((message) => assistantTextsFromMessage(message));
}

function assistantTurnTextsFromLastModelBody(): string[] {
  const last = capturedModelBodies.at(LAST_FROM_END);
  if (last === undefined) {
    return [];
  }
  return assistantTurnTextsFromBody(last);
}

function liveLabeledFromBody(body: unknown): string[] {
  return userTextsFromBody(body).filter((text) => LIVE_LABEL.test(text));
}

function liveLabeledTurnTextsFromModelBodies(): string[] {
  return capturedModelBodies.flatMap((body) => liveLabeledFromBody(body));
}

function liveLabeledTurnTextsFromLastModelBody(): string[] {
  const last = capturedModelBodies.at(LAST_FROM_END);
  if (last === undefined) {
    return [];
  }
  return liveLabeledFromBody(last);
}

function liveLabeledTurnTextsFromPreviousModelBody(): string[] {
  const previous = capturedModelBodies.at(LAST_FROM_END - SINGLE_COUNT);
  if (previous === undefined) {
    return [];
  }
  return liveLabeledFromBody(previous);
}

function lastCapturedModelBodyJson(): string {
  return JSON.stringify(capturedModelBodies.at(LAST_FROM_END) ?? null);
}

export {
  assistantTurnTextsFromLastModelBody,
  capturedModelBodies,
  enqueueModelTexts,
  holdNextModelResponse,
  lastCapturedModelBodyJson,
  liveLabeledTurnTextsFromLastModelBody,
  liveLabeledTurnTextsFromModelBodies,
  liveLabeledTurnTextsFromPreviousModelBody,
  modelServer,
  resetCapturedModelBodies,
  waitUntilModelCallCount,
};
