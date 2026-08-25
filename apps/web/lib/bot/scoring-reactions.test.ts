import { describe, expect, it } from "vitest";

import { closePgliteDb, createPgliteDb } from "@/lib/db/pglite";
import { chatScoringReactions } from "@/lib/db/schema";
import type { MarkType } from "@/lib/domain/mark";

import { DEFAULT_SCORING_REACTIONS } from "./emojis";
import {
  addChatReaction,
  bindingsFromReactions,
  loadChatReactions,
  replaceChatBindings,
  resolveChatBindings,
} from "./scoring-reactions";

const CHAT_ID = -100_111_222;
const NOW = new Date("2026-08-10T12:00:00.000Z");

async function withDb<T>(
  run: (db: Awaited<ReturnType<typeof createPgliteDb>>["db"]) => Promise<T>,
) {
  const pglite = await createPgliteDb();
  try {
    return await run(pglite.db);
  } finally {
    await closePgliteDb(pglite);
  }
}

describe("bindingsFromReactions", () => {
  it("falls back to the built-in defaults when a Chat has no rows", () => {
    expect(bindingsFromReactions([])).toBe(DEFAULT_SCORING_REACTIONS);
  });

  it("scores by nothing when a configured Chat has bound nothing", () => {
    const bindings = bindingsFromReactions([
      { reactionKey: "emoji:👍", markType: null, label: null },
    ]);

    expect(bindings.size).toBe(0);
    expect(bindings.get("emoji:👍")).toBeUndefined();
  });
});

describe("addChatReaction", () => {
  it("adds a reaction unbound, and refuses a repeat", async () => {
    await withDb(async (db) => {
      const input = { chatId: CHAT_ID, reactionKey: "emoji:🤡", label: null };

      expect(await addChatReaction(db, input, NOW)).toBe("added");
      expect(await addChatReaction(db, input, NOW)).toBe("already_present");
      expect(await loadChatReactions(db, CHAT_ID)).toEqual([
        { reactionKey: "emoji:🤡", markType: null, label: null },
      ]);
    });
  });

  it("never unbinds a reaction the Chat has already bound", async () => {
    await withDb(async (db) => {
      // The real order: the command puts it in the palette, a save binds it.
      await addChatReaction(
        db,
        { chatId: CHAT_ID, reactionKey: "emoji:🤡", label: null },
        NOW,
      );
      await replaceChatBindings(
        db,
        CHAT_ID,
        new Map<string, MarkType>([["emoji:🤡", "humor.add"]]),
        NOW,
      );

      expect(
        await addChatReaction(
          db,
          { chatId: CHAT_ID, reactionKey: "emoji:🤡", label: null },
          NOW,
        ),
      ).toBe("already_present");

      const bindings = await resolveChatBindings(db, CHAT_ID);
      expect(bindings.get("emoji:🤡")).toBe("humor.add");
    });
  });
});

describe("replaceChatBindings", () => {
  it("refuses a reaction the palette has never held, and writes nothing", async () => {
    await withDb(async (db) => {
      const result = await replaceChatBindings(
        db,
        CHAT_ID,
        new Map<string, MarkType>([["emoji:🍕", "humor.add"]]),
        NOW,
      );

      expect(result).toEqual({ ok: false, unknown: ["emoji:🍕"] });
      // Refusing must not leave the defaults materialised behind it, or the
      // Chat would read as configured after a save that did nothing.
      expect(await loadChatReactions(db, CHAT_ID)).toEqual([]);
    });
  });

  it("binds a reaction the Add reaction command put in the palette", async () => {
    await withDb(async (db) => {
      await addChatReaction(
        db,
        { chatId: CHAT_ID, reactionKey: "custom_emoji:9001", label: "🎉" },
        NOW,
      );

      expect(
        await replaceChatBindings(
          db,
          CHAT_ID,
          new Map<string, MarkType>([["custom_emoji:9001", "humor.add"]]),
          NOW,
        ),
      ).toEqual({ ok: true });
      expect(
        (await resolveChatBindings(db, CHAT_ID)).get("custom_emoji:9001"),
      ).toBe("humor.add");
    });
  });

  it("always accepts the built-in reactions, palette or not", async () => {
    await withDb(async (db) => {
      expect(
        await replaceChatBindings(
          db,
          CHAT_ID,
          new Map<string, MarkType>([["emoji:🤣", "karma.plus"]]),
          NOW,
        ),
      ).toEqual({ ok: true });
    });
  });

  it("moves a reaction between Marks instead of holding both", async () => {
    await withDb(async (db) => {
      await replaceChatBindings(
        db,
        CHAT_ID,
        new Map<string, MarkType>([["emoji:🤣", "humor.add"]]),
        NOW,
      );
      await replaceChatBindings(
        db,
        CHAT_ID,
        new Map<string, MarkType>([["emoji:🤣", "karma.plus"]]),
        NOW,
      );

      const rows = (await loadChatReactions(db, CHAT_ID)).filter(
        (row) => row.reactionKey === "emoji:🤣",
      );

      expect(rows).toEqual([
        { reactionKey: "emoji:🤣", markType: "karma.plus", label: null },
      ]);
    });
  });

  it("keeps an all-empty save empty instead of reverting to the defaults", async () => {
    await withDb(async (db) => {
      await replaceChatBindings(db, CHAT_ID, new Map(), NOW);

      const reactions = await loadChatReactions(db, CHAT_ID);
      expect(reactions.length).toBe(DEFAULT_SCORING_REACTIONS.size);
      expect(reactions.every((row) => row.markType === null)).toBe(true);

      // The invariant the whole design rests on: rows exist, so the Chat reads
      // as configured, and an empty mapping stays empty across a reload.
      expect((await resolveChatBindings(db, CHAT_ID)).size).toBe(0);
    });
  });

  it("leaves an /addreaction reaction in the palette when a save ignores it", async () => {
    await withDb(async (db) => {
      await addChatReaction(
        db,
        { chatId: CHAT_ID, reactionKey: "custom_emoji:9001", label: "🎉" },
        NOW,
      );
      await replaceChatBindings(
        db,
        CHAT_ID,
        new Map<string, MarkType>([["emoji:👍", "karma.plus"]]),
        NOW,
      );

      expect(await loadChatReactions(db, CHAT_ID)).toContainEqual({
        reactionKey: "custom_emoji:9001",
        markType: null,
        label: "🎉",
      });
    });
  });

  it("isolates one Chat's mapping from another's", async () => {
    await withDb(async (db) => {
      await replaceChatBindings(
        db,
        CHAT_ID,
        new Map<string, MarkType>([["emoji:🤣", "humor.add"]]),
        NOW,
      );

      expect(await resolveChatBindings(db, -100_999_888)).toBe(
        DEFAULT_SCORING_REACTIONS,
      );
    });
  });
});

describe("constraints", () => {
  it("refuses a paid reaction key", async () => {
    await withDb(async (db) => {
      await expect(
        db.insert(chatScoringReactions).values({
          chatId: CHAT_ID,
          reactionKey: "paid",
          markType: null,
          label: null,
          createdAt: NOW,
        }),
      ).rejects.toThrow();
    });
  });

  it("refuses a Mark type outside the closed set", async () => {
    await withDb(async (db) => {
      await expect(
        db.insert(chatScoringReactions).values({
          chatId: CHAT_ID,
          reactionKey: "emoji:🤡",
          markType: "karma.sideways" as MarkType,
          label: null,
          createdAt: NOW,
        }),
      ).rejects.toThrow();
    });
  });
});
