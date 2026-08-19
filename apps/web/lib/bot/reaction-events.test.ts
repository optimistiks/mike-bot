import { describe, expect, it } from "vitest";

import { reactionDiffToEventTypes } from "./reaction-events";

describe("reactionDiffToEventTypes", () => {
  const base = {
    actorId: 101,
    subjectId: 102,
    subjectIsBot: false,
  };

  it.each([
    {
      name: "add karma plus",
      emojiAdded: ["👍"],
      emojiRemoved: [],
      expected: ["karma.plus"],
    },
    {
      name: "remove karma plus",
      emojiAdded: [],
      emojiRemoved: ["👍"],
      expected: ["karma.undo.plus"],
    },
    {
      name: "add karma minus",
      emojiAdded: ["👎"],
      emojiRemoved: [],
      expected: ["karma.minus"],
    },
    {
      name: "remove karma minus",
      emojiAdded: [],
      emojiRemoved: ["👎"],
      expected: ["karma.undo.minus"],
    },
    {
      name: "add humor",
      emojiAdded: ["🤣"],
      emojiRemoved: [],
      expected: ["humor.add"],
    },
    {
      name: "remove humor",
      emojiAdded: [],
      emojiRemoved: ["🤣"],
      expected: ["humor.undo.add"],
    },
    {
      name: "switch karma plus to minus",
      emojiAdded: ["👎"],
      emojiRemoved: ["👍"],
      expected: ["karma.undo.plus", "karma.minus"],
    },
    {
      name: "add humor while karma plus is kept elsewhere",
      emojiAdded: ["🤣"],
      emojiRemoved: [],
      expected: ["humor.add"],
    },
    {
      name: "ignore non-scoring emoji",
      emojiAdded: ["🎉"],
      emojiRemoved: [],
      expected: [],
    },
  ] as const)("$name", ({ emojiAdded, emojiRemoved, expected }) => {
    const result = reactionDiffToEventTypes({
      ...base,
      emojiAdded: [...emojiAdded],
      emojiRemoved: [...emojiRemoved],
    });

    expect(result).toEqual({ ok: true, eventTypes: [...expected] });
  });

  it("skips self-marking", () => {
    expect(
      reactionDiffToEventTypes({
        actorId: 101,
        subjectId: 101,
        subjectIsBot: false,
        emojiAdded: ["👍"],
        emojiRemoved: [],
      }),
    ).toEqual({ ok: false, reason: "self" });
  });

  it("skips bot subjects", () => {
    expect(
      reactionDiffToEventTypes({
        actorId: 101,
        subjectId: 999,
        subjectIsBot: true,
        emojiAdded: ["👍"],
        emojiRemoved: [],
      }),
    ).toEqual({ ok: false, reason: "bot_subject" });
  });
});
