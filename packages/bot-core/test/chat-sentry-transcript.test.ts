import { describe, expect, it } from "vitest";

import { stampRelativeAgeLabels } from "#src/chat/age.js";
import { stampSentrySpanTranscript } from "#src/chat/sentry-transcript.js";

const NOW = new Date("2024-06-15T12:00:00.000Z");
const START = NOW.getTime() / 1000;

describe("relative age ISO labels", () => {
  it("replaces Russian relative age brackets with ISO from now minus the offset", () => {
    expect.hasAssertions();

    expect(stampRelativeAgeLabels("[alice][0 сек. назад]: сейчас", NOW)).toBe(
      "[alice][2024-06-15T12:00:00Z]: сейчас",
    );
    expect(stampRelativeAgeLabels("[alice][5 сек. назад]: че", NOW)).toBe(
      "[alice][2024-06-15T11:59:55Z]: че",
    );
    expect(stampRelativeAgeLabels("[alice][2 ч назад]: давно", NOW)).toBe(
      "[alice][2024-06-15T10:00:00Z]: давно",
    );
    expect(stampRelativeAgeLabels("[Ты][0 сек. назад] в ответ alice: база", NOW)).toBe(
      "[Ты][2024-06-15T12:00:00Z] в ответ alice: база",
    );
  });
});

describe("sentry span transcript", () => {
  it("stamps input and output message attributes on the span", () => {
    expect.hasAssertions();

    const span = {
      data: {
        "gen_ai.input.messages": JSON.stringify([
          { content: "[alice][2 ч назад]: че", role: "user" },
          { content: "[alice][0 сек. назад]: сейчас", role: "user" },
        ]),
        "gen_ai.output.messages": "[Ты][0 сек. назад] в ответ alice: база",
      },
      start_timestamp: START,
    };

    stampSentrySpanTranscript(span);

    expect(JSON.parse(span.data["gen_ai.input.messages"])).toStrictEqual([
      { content: "[alice][2024-06-15T10:00:00Z]: че", role: "user" },
      { content: "[alice][2024-06-15T12:00:00Z]: сейчас", role: "user" },
    ]);
    expect(span.data["gen_ai.output.messages"]).toBe(
      "[Ты][2024-06-15T12:00:00Z] в ответ alice: база",
    );
  });

  it("leaves spans without prompt messages unchanged", () => {
    expect.hasAssertions();

    const span = {
      data: { "http.route": "/api/telegram" },
      start_timestamp: START,
    };

    stampSentrySpanTranscript(span);

    expect(span.data).toStrictEqual({ "http.route": "/api/telegram" });
  });
});
