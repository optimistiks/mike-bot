import { describe, expect, it } from "vitest";

import type {
  ConversationCompleteInput,
  ConversationTurn,
  SpeakerIdentity,
} from "#src/conversation/types.js";

import { MS_PER_SECOND } from "#src/constants.js";
import { conversationMessages } from "#src/conversation/prompt.js";
import { rewriteSentryAiSpan, withSentryTranscript } from "#src/conversation/sentry-transcript.js";

const NOW = new Date("2024-06-15T12:00:00.000Z");
const SECONDS_PER_MINUTE = 60;
const MINUTES_PER_HOUR = 60;
const TWO = 2;
const MS_PER_MINUTE = SECONDS_PER_MINUTE * MS_PER_SECOND;
const MS_PER_HOUR = MINUTES_PER_HOUR * MS_PER_MINUTE;
const TWO_HOURS_MS = TWO * MS_PER_HOUR;

const USERNAME1: SpeakerIdentity = {
  firstName: "Max",
  handle: "username1",
  lastName: null,
};

const USERNAME1_SUFFIX = {
  content: [
    "не больше двух предложений. без эмоджи и заглавных, кроме имён как в метках",
    "в чате разговаривают: username1 (Max)",
    "отвечаешь только пользователю username1",
  ].join("\n"),
  role: "system" as const,
};

function memberTurn(text: string, postedAt: Date): ConversationTurn {
  return {
    label: "username1",
    memberId: 1,
    postedAt,
    reply: null,
    role: "member",
    text,
  };
}

function completeInput(turns: ConversationTurn[]): ConversationCompleteInput {
  return {
    addresseeLabel: "username1",
    conversationId: "conv_test",
    memberId: 1,
    now: NOW,
    speakers: [USERNAME1],
    turns,
  };
}

describe("sentry transcript rewrite", () => {
  it("rewrites relative input labels to absolute ISO times", () => {
    expect.hasAssertions();

    const twoHoursAgo = new Date(NOW.getTime() - TWO_HOURS_MS);
    const input = completeInput([memberTurn("че", twoHoursAgo), memberTurn("сейчас", NOW)]);
    const span = {
      data: {
        "gen_ai.input.messages": JSON.stringify(conversationMessages(input)),
      },
    };

    withSentryTranscript(input, () => {
      rewriteSentryAiSpan(span);
    });

    expect(JSON.parse(span.data["gen_ai.input.messages"])).toStrictEqual([
      { content: "[username1][2024-06-15T10:00:00Z] че", role: "user" },
      { content: "[username1][2024-06-15T12:00:00Z] сейчас", role: "user" },
      USERNAME1_SUFFIX,
    ]);
  });

  it("stamps relative time on captured assistant output", () => {
    expect.hasAssertions();

    const input = completeInput([memberTurn("че", NOW)]);
    const outputMessages = [
      {
        parts: [{ content: '[Ты → username1][0 сек. назад][на "че"] база', type: "text" }],
        role: "assistant",
      },
    ];
    const span = {
      attributes: {
        "gen_ai.output.messages": JSON.stringify(outputMessages),
      },
    };

    withSentryTranscript(input, () => {
      rewriteSentryAiSpan(span);
    });

    expect(JSON.parse(span.attributes["gen_ai.output.messages"])).toStrictEqual([
      {
        parts: [{ content: '[Ты → username1][2024-06-15T12:00:00Z][на "че"] база', type: "text" }],
        role: "assistant",
      },
    ]);
  });

  it("leaves spans unchanged outside a Sentry transcript", () => {
    expect.hasAssertions();

    const captured = '[{"role":"user","content":"[username1][0 сек. назад] че"}]';
    const span = {
      data: {
        "gen_ai.input.messages": captured,
      },
    };

    rewriteSentryAiSpan(span);

    expect(span.data["gen_ai.input.messages"]).toBe(captured);
  });
});
