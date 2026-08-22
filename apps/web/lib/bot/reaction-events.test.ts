import { describe, expect, it } from "vitest";

import type { ReactionType } from "grammy/types";

import {
  diffReactionStates,
  reactionDiffToMarkChanges,
} from "./reaction-events";

describe("reactionDiffToMarkChanges", () => {
  const base = {
    actorId: 101,
    subjectId: 102,
    subjectIsBot: false,
  };

  it.each([
    {
      name: "add karma plus",
      addedReactions: [{ type: "emoji", emoji: "👍" }],
      removedReactions: [],
      expected: [{ action: "add", type: "karma.plus" }],
    },
    {
      name: "remove karma plus",
      addedReactions: [],
      removedReactions: [{ type: "emoji", emoji: "👍" }],
      expected: [{ action: "remove", type: "karma.plus" }],
    },
    {
      name: "add karma minus",
      addedReactions: [{ type: "emoji", emoji: "👎" }],
      removedReactions: [],
      expected: [{ action: "add", type: "karma.minus" }],
    },
    {
      name: "remove karma minus",
      addedReactions: [],
      removedReactions: [{ type: "emoji", emoji: "👎" }],
      expected: [{ action: "remove", type: "karma.minus" }],
    },
    {
      name: "add humor",
      addedReactions: [{ type: "emoji", emoji: "🤣" }],
      removedReactions: [],
      expected: [{ action: "add", type: "humor.add" }],
    },
    {
      name: "remove humor",
      addedReactions: [],
      removedReactions: [{ type: "emoji", emoji: "🤣" }],
      expected: [{ action: "remove", type: "humor.add" }],
    },
    {
      name: "switch karma plus to minus",
      addedReactions: [{ type: "emoji", emoji: "👎" }],
      removedReactions: [{ type: "emoji", emoji: "👍" }],
      expected: [
        { action: "remove", type: "karma.plus" },
        { action: "add", type: "karma.minus" },
      ],
    },
    {
      name: "add humor while karma plus is kept elsewhere",
      addedReactions: [{ type: "emoji", emoji: "🤣" }],
      removedReactions: [],
      expected: [{ action: "add", type: "humor.add" }],
    },
    {
      name: "ignore non-scoring emoji",
      addedReactions: [{ type: "emoji", emoji: "🎉" }],
      removedReactions: [],
      expected: [],
    },
  ] as const)("$name", ({ addedReactions, removedReactions, expected }) => {
    const result = reactionDiffToMarkChanges({
      ...base,
      addedReactions: [...addedReactions],
      removedReactions: [...removedReactions],
    });

    expect(result).toEqual({ ok: true, changes: [...expected] });
  });

  it("skips self-marking", () => {
    expect(
      reactionDiffToMarkChanges({
        actorId: 101,
        subjectId: 101,
        subjectIsBot: false,
        addedReactions: [{ type: "emoji", emoji: "👍" }],
        removedReactions: [],
      }),
    ).toEqual({ ok: false, reason: "self" });
  });

  it("skips bot subjects", () => {
    expect(
      reactionDiffToMarkChanges({
        actorId: 101,
        subjectId: 999,
        subjectIsBot: true,
        addedReactions: [{ type: "emoji", emoji: "👍" }],
        removedReactions: [],
      }),
    ).toEqual({ ok: false, reason: "bot_subject" });
  });

  it("diffs complete Telegram reaction states", () => {
    const karmaPlus = { type: "emoji", emoji: "👍" } satisfies ReactionType;
    const karmaMinus = { type: "emoji", emoji: "👎" } satisfies ReactionType;
    const custom = {
      type: "custom_emoji",
      custom_emoji_id: "custom-1",
    } satisfies ReactionType;

    expect(
      diffReactionStates([karmaPlus, custom], [karmaPlus, karmaMinus, custom]),
    ).toEqual({ addedReactions: [karmaMinus], removedReactions: [] });
  });
});
