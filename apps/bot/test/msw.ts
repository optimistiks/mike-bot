import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";

export const capturedModelBodies: unknown[] = [];

export const modelServer = setupServer(
  http.post("https://ai-gateway.vercel.sh/v4/ai/language-model", async ({ request }) => {
    const body: unknown = await request.json();
    capturedModelBodies.push(body);
    return HttpResponse.json({
      content: [{ type: "text", text: "че" }],
      finishReason: { unified: "stop", raw: "stop" },
      usage: {
        inputTokens: {
          total: 10,
          noCache: 10,
          cacheRead: 0,
          cacheWrite: 0,
        },
        outputTokens: { total: 1, text: 1, reasoning: 0 },
      },
    });
  }),
);

export function resetCapturedModelBodies(): void {
  capturedModelBodies.length = 0;
}

export function userTurnTextsFromModelBodies(): string[] {
  const texts: string[] = [];
  for (const body of capturedModelBodies) {
    if (typeof body !== "object" || body === null || !("prompt" in body)) {
      continue;
    }
    const prompt = body.prompt;
    if (!Array.isArray(prompt)) {
      continue;
    }
    for (const message of prompt) {
      if (
        typeof message !== "object" ||
        message === null ||
        !("role" in message) ||
        message.role !== "user" ||
        !("content" in message) ||
        !Array.isArray(message.content)
      ) {
        continue;
      }
      for (const part of message.content) {
        if (
          typeof part === "object" &&
          part !== null &&
          "type" in part &&
          part.type === "text" &&
          "text" in part &&
          typeof part.text === "string"
        ) {
          texts.push(part.text);
        }
      }
    }
  }
  return texts;
}
