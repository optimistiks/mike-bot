import { describe, expect, it } from "vitest";
import { isNull } from "drizzle-orm";

import { closePgliteDb, createPgliteDb } from "@/lib/db/pglite";
import type { AppDatabase } from "@/lib/db/runtime";
import { marks, messageAuthors } from "@/lib/db/schema";
import { markTypeSchema } from "@/lib/domain/mark";
import {
  aggregateLeaderboard,
  MARK_UNDO_WINDOW_MS,
  seasonForDate,
} from "@/lib/scoring";

import { applyMarkChanges, type ApplyMarkChangesInput } from "./marks";

const identity = {
  chatId: -100_123,
  actorId: 10,
  subjectId: 20,
  messageId: 30,
};
const markedAt = new Date("2026-08-10T12:00:00.000Z");

/** A moment `offsetMs` after the Mark was placed. */
function later(offsetMs: number): Date {
  return new Date(markedAt.getTime() + offsetMs);
}

const NOTHING_HAPPENED = { added: 0, undone: 0, refused: 1 };

describe("applyMarkChanges", () => {
  async function setup() {
    const pglite = await createPgliteDb();
    await pglite.db.insert(messageAuthors).values({
      chatId: identity.chatId,
      messageId: identity.messageId,
      authorId: identity.subjectId,
      authorIsBot: false,
      messageDate: Math.floor(markedAt.getTime() / 1_000),
    });

    let updateId = 0;
    const apply = (
      input: Omit<ApplyMarkChangesInput, "identity" | "createdAt" | "updateId">,
      createdAt = markedAt,
    ) => {
      // Every Scoring action arrives on its own update, in the order applied.
      updateId += 1;
      return pglite.db.transaction((transaction) =>
        applyMarkChanges(transaction as unknown as AppDatabase, {
          ...input,
          identity,
          createdAt,
          updateId,
        }),
      );
    };

    const react = (
      changes: ApplyMarkChangesInput["changes"],
      createdAt = markedAt,
    ) => apply({ changes, source: "reaction" }, createdAt);

    // An undone Scoring reaction leaves a tombstone behind, so "what is stored"
    // and "what still holds a slot" are different questions.
    const liveTypes = async () =>
      (await pglite.db.select().from(marks).where(isNull(marks.undoneAt))).map(
        (row) => row.type,
      );

    return { ...pglite, apply, react, liveTypes };
  }

  it("spends the karma grant once, whichever way it is spent", async () => {
    const pglite = await setup();

    try {
      await pglite.react([{ action: "add", type: "karma.plus" }]);

      await expect(
        pglite.react([{ action: "add", type: "karma.plus" }]),
      ).resolves.toEqual(NOTHING_HAPPENED);
      await expect(
        pglite.react([{ action: "add", type: "karma.minus" }]),
      ).resolves.toEqual(NOTHING_HAPPENED);
      await expect(
        pglite.apply({
          changes: [{ action: "add", type: "karma.minus" }],
          source: "reply",
        }),
      ).resolves.toEqual(NOTHING_HAPPENED);

      await expect(pglite.liveTypes()).resolves.toEqual(["karma.plus"]);
    } finally {
      await closePgliteDb(pglite);
    }
  });

  it("leaves the humor grant untouched when the karma grant is spent", async () => {
    const pglite = await setup();

    try {
      await pglite.react([{ action: "add", type: "karma.minus" }]);
      await expect(
        pglite.react([{ action: "add", type: "humor.add" }]),
      ).resolves.toEqual({ added: 1, undone: 0, refused: 0 });

      const rows = await pglite.db.select().from(marks);
      expect(rows.map((row) => row.slot).toSorted()).toEqual([
        "humor",
        "karma",
      ]);

      const leaderboard = aggregateLeaderboard(
        rows.map((row) => ({
          type: markTypeSchema.parse(row.type),
          actorId: row.actorId,
          subjectId: row.subjectId,
          season: seasonForDate(row.createdAt),
        })),
        { year: 2026, month: 8 },
      );
      expect(leaderboard.sections[0]?.entries).toEqual([
        {
          userId: identity.subjectId,
          score: -1,
          isCrown: true,
          isChicken: false,
        },
      ]);
      expect(leaderboard.sections[1]?.entries).toEqual([
        {
          userId: identity.subjectId,
          score: 1,
          isCrown: true,
          isChicken: false,
        },
      ]);
    } finally {
      await closePgliteDb(pglite);
    }
  });

  it("takes a reaction back inside the Undo window and refunds the grant", async () => {
    const pglite = await setup();

    try {
      await pglite.react([{ action: "add", type: "karma.plus" }]);
      await expect(
        pglite.react(
          [{ action: "remove", type: "karma.plus" }],
          later(MARK_UNDO_WINDOW_MS),
        ),
      ).resolves.toEqual({ added: 0, undone: 1, refused: 0 });
      await expect(pglite.liveTypes()).resolves.toEqual([]);

      await expect(
        pglite.react([{ action: "add", type: "karma.minus" }], later(6_000)),
      ).resolves.toEqual({ added: 1, undone: 0, refused: 0 });
      await expect(pglite.liveTypes()).resolves.toEqual(["karma.minus"]);
    } finally {
      await closePgliteDb(pglite);
    }
  });

  it("keeps a reaction Mark once the Undo window has closed", async () => {
    const pglite = await setup();

    try {
      await pglite.react([{ action: "add", type: "karma.plus" }]);
      await expect(
        pglite.react(
          [{ action: "remove", type: "karma.plus" }],
          later(MARK_UNDO_WINDOW_MS + 1),
        ),
      ).resolves.toEqual(NOTHING_HAPPENED);
      await expect(pglite.liveTypes()).resolves.toEqual(["karma.plus"]);
    } finally {
      await closePgliteDb(pglite);
    }
  });

  it("switches 👍 to 👎 inside the window but not outside it", async () => {
    const pglite = await setup();
    const switchToMinus = [
      { action: "remove", type: "karma.plus" },
      { action: "add", type: "karma.minus" },
    ] as const;

    try {
      await pglite.react([{ action: "add", type: "karma.plus" }]);
      await expect(pglite.react(switchToMinus, later(2_000))).resolves.toEqual({
        added: 1,
        undone: 1,
        refused: 0,
      });
      await expect(pglite.liveTypes()).resolves.toEqual(["karma.minus"]);
    } finally {
      await closePgliteDb(pglite);
    }

    const late = await setup();
    try {
      await late.react([{ action: "add", type: "karma.plus" }]);
      await expect(late.react(switchToMinus, later(60_000))).resolves.toEqual({
        added: 0,
        undone: 0,
        refused: 2,
      });
      await expect(late.liveTypes()).resolves.toEqual(["karma.plus"]);
    } finally {
      await closePgliteDb(late);
    }
  });

  it("never lets a reaction removal take back a Scoring reply", async () => {
    const pglite = await setup();

    try {
      await pglite.apply({
        changes: [{ action: "add", type: "karma.minus" }],
        source: "reply",
      });

      // The 👎 reaction below is refused — the grant is already spent — so
      // removing it must not delete the reply Mark sharing the karma slot.
      await expect(
        pglite.react([{ action: "add", type: "karma.minus" }], later(1_000)),
      ).resolves.toEqual(NOTHING_HAPPENED);
      await expect(
        pglite.react([{ action: "remove", type: "karma.minus" }], later(2_000)),
      ).resolves.toEqual(NOTHING_HAPPENED);

      await expect(pglite.liveTypes()).resolves.toEqual(["karma.minus"]);
    } finally {
      await closePgliteDb(pglite);
    }
  });

  it("admits only one of two concurrent additions", async () => {
    const pglite = await setup();

    try {
      const changes = [{ action: "add", type: "karma.plus" }] as const;
      const results = await Promise.all([
        pglite.react(changes),
        pglite.react(changes),
      ]);

      expect(results.reduce((sum, result) => sum + result.added, 0)).toBe(1);
      await expect(pglite.liveTypes()).resolves.toEqual(["karma.plus"]);
    } finally {
      await closePgliteDb(pglite);
    }
  });
});
