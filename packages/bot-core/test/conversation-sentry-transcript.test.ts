import { describe, expect, it } from "vitest";

import { rewriteSentryAiSpan, withSentryTranscript } from "#src/conversation/sentry-transcript.js";

const NOW = new Date("2024-06-15T12:00:00.000Z");
const ISO = "2024-06-15T12:00:00Z";

describe("sentry transcript rewrite", () => {
  it("stamps the current turn's time label to ISO and leaves older ages", () => {
    expect.hasAssertions();

    const span = {
      data: {
        "gen_ai.input.messages":
          '[{"role":"user","content":"[username1][2 ч назад] че"},{"role":"user","content":"[username1][0 сек. назад] сейчас"}]',
        "gen_ai.output.messages": '[Ты → username1][0 сек. назад][на "сейчас"] база',
      },
    };

    withSentryTranscript(NOW, () => {
      rewriteSentryAiSpan(span);
    });

    expect(span.data["gen_ai.input.messages"]).toBe(
      `[{"role":"user","content":"[username1][2 ч назад] че"},{"role":"user","content":"[username1][${ISO}] сейчас"}]`,
    );
    expect(span.data["gen_ai.output.messages"]).toBe(`[Ты → username1][${ISO}][на "сейчас"] база`);
  });

  it("leaves spans unchanged outside a Sentry transcript", () => {
    expect.hasAssertions();

    const captured = "[username1][0 сек. назад] че";
    const span = {
      data: {
        "gen_ai.input.messages": captured,
      },
    };

    rewriteSentryAiSpan(span);

    expect(span.data["gen_ai.input.messages"]).toBe(captured);
  });
});
