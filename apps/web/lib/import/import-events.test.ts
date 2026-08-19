import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { closePgliteDb, createPgliteDb } from "@/lib/db/pglite";
import { chatMembers, events } from "@/lib/db/schema";
import { queryLeaderboard } from "@/lib/leaderboard/query";

import { importV1Rows } from "./import-events";

const IMPORT_CHAT_ID = -100_999_888;

const SAMPLE_ROW = {
  id: "11111111-1111-4111-8111-111111111111",
  createdAt: Date.parse("2026-07-31T21:00:00.000Z"),
  lolType: "plus" as const,
  fromUser: { id: 501, username: "giver" },
  toUser: { id: 502, username: "receiver" },
  chatId: IMPORT_CHAT_ID,
  toMessageId: 77,
};

describe("importV1Rows", () => {
  it("inserts events and chat_members from v1 rows", async () => {
    const pglite = await createPgliteDb();

    try {
      const stats = await importV1Rows(pglite.db, [SAMPLE_ROW]);

      expect(stats).toEqual({
        rowsProcessed: 1,
        eventsInserted: 1,
        eventsSkipped: 0,
        membersUpserted: 2,
      });

      const storedEvents = await pglite.db
        .select()
        .from(events)
        .where(eq(events.chatId, IMPORT_CHAT_ID));

      expect(storedEvents).toHaveLength(1);
      expect(storedEvents[0]).toMatchObject({
        type: "karma.plus",
        actorId: 501,
        subjectId: 502,
        messageId: 77,
        legacyId: SAMPLE_ROW.id,
      });

      const storedMembers = await pglite.db
        .select()
        .from(chatMembers)
        .where(eq(chatMembers.chatId, IMPORT_CHAT_ID));

      expect(storedMembers).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            userId: 501,
            displayName: "@giver",
          }),
          expect.objectContaining({
            userId: 502,
            displayName: "@receiver",
          }),
        ]),
      );
    } finally {
      await closePgliteDb(pglite);
    }
  });

  it("is idempotent on legacy_id", async () => {
    const pglite = await createPgliteDb();

    try {
      const first = await importV1Rows(pglite.db, [SAMPLE_ROW]);
      const second = await importV1Rows(pglite.db, [SAMPLE_ROW]);

      expect(first.eventsInserted).toBe(1);
      expect(second.eventsInserted).toBe(0);
      expect(second.eventsSkipped).toBe(1);

      const storedEvents = await pglite.db
        .select({ id: events.id })
        .from(events)
        .where(eq(events.legacyId, SAMPLE_ROW.id));

      expect(storedEvents).toHaveLength(1);
    } finally {
      await closePgliteDb(pglite);
    }
  });

  it("buckets imported created_at into Europe/Moscow seasons for leaderboards", async () => {
    const pglite = await createPgliteDb();

    try {
      await importV1Rows(pglite.db, [SAMPLE_ROW]);

      const augustLeaderboard = await queryLeaderboard(
        pglite.db,
        IMPORT_CHAT_ID,
        { year: 2026, month: 8 },
      );

      expect(augustLeaderboard.sections[0]?.entries).toEqual([
        expect.objectContaining({
          displayName: "@receiver",
          score: 1,
          isCrown: true,
        }),
      ]);

      const julyLeaderboard = await queryLeaderboard(
        pglite.db,
        IMPORT_CHAT_ID,
        { year: 2026, month: 7 },
      );

      expect(julyLeaderboard.sections[0]?.entries ?? []).toHaveLength(0);
    } finally {
      await closePgliteDb(pglite);
    }
  });
});
