import { describe, expect, it } from "vitest";

import type { ConversationCompleteInput, ConversationTurn } from "#src/conversation/types.js";

import {
  stampSentryTranscriptSpan,
  transcriptStampFrom,
  withSentryTranscript,
} from "#src/conversation/sentry-transcript.js";

const NOW = new Date("2024-06-15T12:00:00.000Z");
const ISO = "2024-06-15T12:00:00Z";
const AGE = "0 сек. назад";

function memberTurn(text: string, postedAt: Date): ConversationTurn {
  return { label: "username1", memberId: 1, postedAt, reply: null, role: "member", text };
}

function completeInput(turns: ConversationTurn[]): ConversationCompleteInput {
  return {
    addresseeLabel: "username1",
    conversationId: "conv_test",
    memberId: 1,
    now: NOW,
    speakers: [{ firstName: "Max", handle: "username1", lastName: null }],
    turns,
  };
}

describe("sentry transcript stamp", () => {
  it("stamps only the last user line from span attributes and leaves older ages and output", () => {
    expect.hasAssertions();

    const span = {
      attributes: {
        "gen_ai.input.messages": JSON.stringify([
          { content: "[username1][2 ч назад] че", role: "user" },
          { content: `[username1][${AGE}] сейчас`, role: "user" },
          { content: "отвечаешь только пользователю username1", role: "system" },
        ]),
        "gen_ai.output.messages": `[Ты → username1][${AGE}][на "сейчас"] база`,
        "mike.transcript.age": AGE,
        "mike.transcript.iso": ISO,
      },
    };

    stampSentryTranscriptSpan(span);

    expect(JSON.parse(span.attributes["gen_ai.input.messages"])).toStrictEqual([
      { content: "[username1][2 ч назад] че", role: "user" },
      { content: `[username1][${ISO}] сейчас`, role: "user" },
      { content: "отвечаешь только пользователю username1", role: "system" },
    ]);
    expect(span.attributes["gen_ai.output.messages"]).toBe(
      `[Ты → username1][${AGE}][на "сейчас"] база`,
    );
  });

  it("stamps the last user text part when the SDK uses parts", () => {
    expect.hasAssertions();

    const span = {
      data: {
        "ai.prompt.messages": JSON.stringify([
          {
            parts: [{ content: `[username1][${AGE}] сейчас`, type: "text" }],
            role: "user",
          },
        ]),
        "mike.transcript.age": AGE,
        "mike.transcript.iso": ISO,
      },
    };

    stampSentryTranscriptSpan(span);

    expect(JSON.parse(span.data["ai.prompt.messages"])).toStrictEqual([
      {
        parts: [{ content: `[username1][${ISO}] сейчас`, type: "text" }],
        role: "user",
      },
    ]);
  });

  it("stamps at span start from the live transcript, then again from attributes without ALS", () => {
    expect.hasAssertions();

    const attributes: Record<string, string> = {
      "gen_ai.input.messages": JSON.stringify([
        { content: `[username1][${AGE}] сейчас`, role: "user" },
      ]),
    };
    const span = { attributes };

    withSentryTranscript({ age: AGE, iso: ISO }, () => {
      stampSentryTranscriptSpan(span);
    });

    expect(attributes["mike.transcript.iso"]).toBe(ISO);
    expect(attributes["gen_ai.input.messages"]).toBe(
      JSON.stringify([{ content: `[username1][${ISO}] сейчас`, role: "user" }]),
    );

    attributes["gen_ai.input.messages"] = JSON.stringify([
      { content: `[username1][${AGE}] сейчас`, role: "user" },
    ]);
    stampSentryTranscriptSpan(span);

    expect(attributes["gen_ai.input.messages"]).toBe(
      JSON.stringify([{ content: `[username1][${ISO}] сейчас`, role: "user" }]),
    );
  });

  it("does not attach transcript attrs to spans without prompt input", () => {
    expect.hasAssertions();

    const attributes: Record<string, string> = {
      "gen_ai.operation.name": "invoke_agent",
    };
    const span = { attributes };

    withSentryTranscript({ age: AGE, iso: ISO }, () => {
      stampSentryTranscriptSpan(span);
    });

    expect(attributes).toStrictEqual({
      "gen_ai.operation.name": "invoke_agent",
    });
  });

  it("leaves spans unchanged without a transcript stamp", () => {
    expect.hasAssertions();

    const captured = JSON.stringify([{ content: `[username1][${AGE}] че`, role: "user" }]);
    const span = {
      data: {
        "gen_ai.input.messages": captured,
      },
    };

    stampSentryTranscriptSpan(span);

    expect(span.data["gen_ai.input.messages"]).toBe(captured);
  });

  it("uses the last member turn's postedAt, not completion now", () => {
    expect.hasAssertions();

    const postedAt = new Date("2024-06-15T11:59:59.000Z");
    const turns = [memberTurn("сейчас", postedAt)];
    expect(transcriptStampFrom(completeInput(turns))).toStrictEqual({
      age: "1 сек. назад",
      iso: "2024-06-15T11:59:59Z",
    });
  });
});
