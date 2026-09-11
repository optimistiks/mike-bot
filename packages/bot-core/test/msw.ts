import { HttpResponse, delay, http } from "msw";
import { setupServer } from "msw/node";
import { once } from "node:events";
import { z } from "zod";

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

const LIVE_LABEL = /^\[[^\]]+\]\[/u;
const POLL_MS = 10;
const TELEGRAM_API = /https:\/\/api\.telegram\.org\/bot[^/]+\/(?<method>[A-Za-z]+)$/u;
const TELEGRAM_FIRST_MESSAGE_ID = 10_000;
const TELEGRAM_SENT_DATE = 1_700_000_000;

const capturedModelBodies: unknown[] = [];
const capturedTelegramMessageIds: number[] = [];
const queuedTexts: string[] = [];
const holdEvents = new EventTarget();

let holdGate: Promise<undefined> | null = null;
let nextTelegramMessageId = TELEGRAM_FIRST_MESSAGE_ID;
let failNextTelegram = false;

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

function telegramSendResult(messageId: number, text: string): ReturnType<typeof HttpResponse.json> {
  return HttpResponse.json({
    ok: true,
    result: {
      chat: { id: -1001, type: "supergroup" },
      date: TELEGRAM_SENT_DATE,
      message_id: messageId,
      text,
    },
  });
}

function telegramTextFromBody(body: unknown): string {
  if (typeof body !== "object" || body === null || !("text" in body)) {
    return "";
  }
  if (typeof body.text !== "string") {
    return "";
  }
  return body.text;
}

function failTelegramSend(): ReturnType<typeof HttpResponse.json> {
  failNextTelegram = false;
  return HttpResponse.json({ description: "failed", error_code: 400, ok: false }, { status: 400 });
}

function succeedTelegramSend(body: unknown): ReturnType<typeof HttpResponse.json> {
  const messageId = nextTelegramMessageId;
  nextTelegramMessageId += 1;
  capturedTelegramMessageIds.push(messageId);
  return telegramSendResult(messageId, telegramTextFromBody(body));
}

function telegramResponse(method: string, body: unknown): ReturnType<typeof HttpResponse.json> {
  if (method === "deleteMessage") {
    return HttpResponse.json({ ok: true, result: true });
  }
  if (method !== "sendMessage" && method !== "sendRichMessage") {
    return HttpResponse.json({ ok: true, result: true });
  }
  if (failNextTelegram) {
    return failTelegramSend();
  }
  return succeedTelegramSend(body);
}

const modelServer = setupServer(
  http.post("https://ai-gateway.vercel.sh/v4/ai/language-model", async ({ request }) => {
    const body: unknown = await request.json();
    capturedModelBodies.push(body);
    await waitIfHeld();
    return modelJson(nextModelText());
  }),
  http.post(TELEGRAM_API, async ({ params, request }) => {
    const method = typeof params.method === "string" ? params.method : "";
    const body: unknown = method === "deleteMessage" ? null : await request.json();
    return telegramResponse(method, body);
  }),
);

function resetCapturedModelBodies(): void {
  capturedModelBodies.length = 0;
  capturedTelegramMessageIds.length = 0;
  queuedTexts.length = 0;
  nextTelegramMessageId = TELEGRAM_FIRST_MESSAGE_ID;
  failNextTelegram = false;
  holdEvents.dispatchEvent(new Event("release"));
  holdGate = null;
}

function failNextTelegramSend(): void {
  failNextTelegram = true;
}

function lastSentTelegramMessageId(): number {
  const messageId = capturedTelegramMessageIds.at(-1);
  if (messageId === undefined) {
    throw new Error("no Telegram send was captured");
  }
  return messageId;
}

function failNextModelRequest(): void {
  modelServer.use(
    http.post("https://ai-gateway.vercel.sh/v4/ai/language-model", () =>
      HttpResponse.json({ error: "unavailable" }, { status: 500 }),
    ),
  );
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
  const last = capturedModelBodies.at(-1);
  if (last === undefined) {
    return [];
  }
  return assistantTurnTextsFromBody(last);
}

function liveLabeledFromBody(body: unknown): string[] {
  return userTextsFromBody(body).filter((text) => LIVE_LABEL.test(text));
}

function liveLabeledTurnTextsFromLastModelBody(): string[] {
  const last = capturedModelBodies.at(-1);
  if (last === undefined) {
    return [];
  }
  return liveLabeledFromBody(last);
}

function lastCapturedModelBodyJson(): string {
  return JSON.stringify(capturedModelBodies.at(-1) ?? null);
}

export {
  assistantTurnTextsFromLastModelBody,
  capturedModelBodies,
  enqueueModelTexts,
  failNextModelRequest,
  failNextTelegramSend,
  holdNextModelResponse,
  lastCapturedModelBodyJson,
  lastSentTelegramMessageId,
  liveLabeledTurnTextsFromLastModelBody,
  modelServer,
  resetCapturedModelBodies,
  waitUntilModelCallCount,
};
