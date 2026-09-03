import { HttpResponse, http } from "msw";
import { setupServer } from "msw/node";
import { z } from "zod";

const textPartSchema = z.object({
  text: z.string(),
  type: z.literal("text"),
});

const userMessageSchema = z.object({
  content: z.array(z.unknown()),
  role: z.literal("user"),
});

const bodySchema = z.object({
  prompt: z.array(z.unknown()),
});

const capturedModelBodies: unknown[] = [];

const modelServer = setupServer(
  http.post("https://ai-gateway.vercel.sh/v4/ai/language-model", async ({ request }) => {
    const body: unknown = await request.json();
    capturedModelBodies.push(body);
    return HttpResponse.json({
      content: [{ text: "че", type: "text" }],
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
  }),
);

function resetCapturedModelBodies(): void {
  capturedModelBodies.length = 0;
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

function userTurnTextsFromModelBodies(): string[] {
  return capturedModelBodies.flatMap((body) => userTextsFromBody(body));
}

export { capturedModelBodies, modelServer, resetCapturedModelBodies, userTurnTextsFromModelBodies };
