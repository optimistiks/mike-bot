import { describe, expect, it } from "vitest";

import { closePgliteDb, createPgliteDb } from "@/lib/db/pglite";
import type { AppDatabase } from "@/lib/db/runtime";
import { events, messageAuthors } from "@/lib/db/schema";
import { aggregateLeaderboard, seasonForDate } from "@/lib/scoring";

import { applyMarkChanges, type ApplyMarkChangesInput } from "./marks";

const identity = {
  chatId: -100_123,
  actorId: 10,
  subjectId: 20,
  messageId: 30,
};
const createdAt = new Date("2026-08-10T12:00:00.000Z");

describe("applyMarkChanges", () => {
  async function setup() {
    const pglite = await createPgliteDb();
    await pglite.db.insert(messageAuthors).values({
      chatId: identity.chatId,
      messageId: identity.messageId,
      authorId: identity.subjectId,
      authorIsBot: false,
      messageDate: Math.floor(createdAt.getTime() / 1_000),
    });
    const apply = (
      input: Omit<ApplyMarkChangesInput, "identity" | "createdAt">,
    ) =>
      pglite.db.transaction((transaction) =>
        applyMarkChanges(transaction as unknown as AppDatabase, {
          ...input,
          identity,
          createdAt,
        }),
      );
    return { ...pglite, apply };
  }

  it("prevents duplicate active Marks while allowing plus and minus together", async () => {
    const pglite = await setup();

    try {
      await pglite.apply({
        changes: [{ action: "add", type: "karma.plus" }],
        additionsAreReversible: true,
      });
      await expect(
        pglite.apply({
          changes: [{ action: "add", type: "karma.plus" }],
          additionsAreReversible: true,
        }),
      ).resolves.toEqual({ additions: 0, reversals: 0 });
      await pglite.apply({
        changes: [{ action: "add", type: "karma.minus" }],
        additionsAreReversible: true,
      });

      const rows = await pglite.db.select().from(events);
      expect(rows).toHaveLength(2);
      const leaderboard = aggregateLeaderboard(
        rows.map((row) => ({
          type: row.type as "karma.plus" | "karma.minus",
          actorId: row.actorId,
          subjectId: row.subjectId,
          isReversal: row.reversesEventId !== null,
          season: seasonForDate(row.createdAt),
        })),
        { year: 2026, month: 8 },
      );
      expect(leaderboard.sections[0]?.entries).toEqual([]);
    } finally {
      await closePgliteDb(pglite);
    }
  });

  it("serializes concurrent duplicate additions on the Message row", async () => {
    const pglite = await setup();

    try {
      const input = {
        changes: [{ action: "add", type: "karma.plus" }] as const,
        additionsAreReversible: true,
      };
      const results = await Promise.all([
        pglite.apply(input),
        pglite.apply(input),
      ]);

      expect(results.reduce((sum, result) => sum + result.additions, 0)).toBe(
        1,
      );
      await expect(pglite.db.select().from(events)).resolves.toHaveLength(1);
    } finally {
      await closePgliteDb(pglite);
    }
  });

  it("creates exact add/reverse/re-add cycles and processes switches removal-first", async () => {
    const pglite = await setup();

    try {
      await pglite.apply({
        changes: [{ action: "add", type: "karma.plus" }],
        additionsAreReversible: true,
      });
      await pglite.apply({
        changes: [
          { action: "remove", type: "karma.plus" },
          { action: "add", type: "karma.minus" },
        ],
        additionsAreReversible: true,
      });
      await pglite.apply({
        changes: [{ action: "add", type: "karma.plus" }],
        additionsAreReversible: true,
      });

      const rows = await pglite.db.select().from(events);
      expect(rows.map((row) => row.type)).toEqual([
        "karma.plus",
        "karma.plus",
        "karma.minus",
        "karma.plus",
      ]);
      expect(rows[1]).toMatchObject({
        actorId: rows[0]?.actorId,
        subjectId: rows[0]?.subjectId,
        messageId: rows[0]?.messageId,
        reversible: false,
        reversesEventId: rows[0]?.id,
      });
      expect(rows[3]?.reversesEventId).toBeNull();
    } finally {
      await closePgliteDb(pglite);
    }
  });

  it("does not reverse a permanent reply or imported Mark", async () => {
    const pglite = await setup();

    try {
      await pglite.apply({
        changes: [{ action: "add", type: "humor.add" }],
        additionsAreReversible: false,
      });
      await expect(
        pglite.apply({
          changes: [{ action: "remove", type: "humor.add" }],
          additionsAreReversible: true,
        }),
      ).resolves.toEqual({ additions: 0, reversals: 0 });
      await expect(pglite.db.select().from(events)).resolves.toHaveLength(1);
    } finally {
      await closePgliteDb(pglite);
    }
  });
});
