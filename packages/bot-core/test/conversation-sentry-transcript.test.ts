import { describe, expect, it } from "vitest";

import type {
  ConversationCompleteInput,
  ConversationTurn,
  SpeakerIdentity,
} from "#src/conversation/types.js";

import { conversationMessages, sentryConversationMessages } from "#src/conversation/prompt.js";
import { rewriteSentryAiSpan, withSentryTranscript } from "#src/conversation/sentry-transcript.js";

const NOW = new Date("2024-06-15T12:00:00.000Z");

const USERNAME1: SpeakerIdentity = {
  firstName: "Max",
  handle: "username1",
  lastName: null,
};

function completeInput(text: string): ConversationCompleteInput {
  const turn: ConversationTurn = {
    label: "username1",
    memberId: 1,
    postedAt: NOW,
    reply: null,
    role: "member",
    text,
  };
  return {
    addresseeLabel: "username1",
    conversationId: "conv_test",
    memberId: 1,
    now: NOW,
    speakers: [USERNAME1],
    turns: [turn],
  };
}

describe("sentry transcript rewrite", () => {
  it("replaces captured input with absolute-time messages", () => {
    expect.hasAssertions();

    const input = completeInput("че");
    const span = {
      data: {
        "gen_ai.input.messages": JSON.stringify(conversationMessages(input)),
      },
    };

    withSentryTranscript(input, () => {
      rewriteSentryAiSpan(span);
    });

    expect(span.data["gen_ai.input.messages"]).toBe(
      JSON.stringify(sentryConversationMessages(input)),
    );
  });

  it("stamps relative time on captured assistant output", () => {
    expect.hasAssertions();

    const input = completeInput("че");
    const span = {
      attributes: {
        "gen_ai.output.messages": '[Ты → username1][0 сек. назад][на "че"] база',
      },
    };

    withSentryTranscript(input, () => {
      rewriteSentryAiSpan(span);
    });

    expect(span.attributes["gen_ai.output.messages"]).toBe(
      '[Ты → username1][2024-06-15T12:00:00Z][на "че"] база',
    );
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
