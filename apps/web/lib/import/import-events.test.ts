import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { closePgliteDb, createPgliteDb } from "@/lib/db/pglite";
import { displayIdentities, events, messageAuthors } from "@/lib/db/schema";
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
  it("inserts Events and Display identities from v1 rows", async () => {
    const pglite = await createPgliteDb();

    try {
      const stats = await importV1Rows(pglite.db, [SAMPLE_ROW]);

      expect(stats).toEqual({
        rowsProcessed: 1,
        events: { inserted: 1, updated: 0, unchanged: 0, skipped: 0 },
        messages: { inserted: 1, updated: 0, unchanged: 0, skipped: 0 },
        displayIdentities: {
          inserted: 2,
          updated: 0,
          unchanged: 0,
          skipped: 0,
        },
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
        reversible: false,
        reversesEventId: null,
        legacyId: SAMPLE_ROW.id,
      });

      await expect(
        pglite.db
          .select()
          .from(messageAuthors)
          .where(eq(messageAuthors.chatId, IMPORT_CHAT_ID)),
      ).resolves.toEqual([
        expect.objectContaining({
          messageId: 77,
          authorId: 502,
          messageDate: Math.floor(SAMPLE_ROW.createdAt / 1_000),
        }),
      ]);

      const storedMembers = await pglite.db
        .select()
        .from(displayIdentities)
        .where(eq(displayIdentities.chatId, IMPORT_CHAT_ID));

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

      expect(first.events.inserted).toBe(1);
      expect(second.events).toEqual({
        inserted: 0,
        updated: 0,
        unchanged: 1,
        skipped: 0,
      });
      expect(second.messages.unchanged).toBe(1);
      expect(second.displayIdentities.unchanged).toBe(2);

      const storedEvents = await pglite.db
        .select({ id: events.id })
        .from(events)
        .where(eq(events.legacyId, SAMPLE_ROW.id));

      expect(storedEvents).toHaveLength(1);
    } finally {
      await closePgliteDb(pglite);
    }
  });

  it("updates identities to the newest name in the v1 snapshot", async () => {
    const pglite = await createPgliteDb();

    try {
      await pglite.db.insert(displayIdentities).values({
        chatId: IMPORT_CHAT_ID,
        userId: 501,
        displayName: "@current-giver",
      });
      const older = {
        ...SAMPLE_ROW,
        id: "22222222-2222-4222-8222-222222222222",
        createdAt: SAMPLE_ROW.createdAt - 1_000,
        toUser: { id: 503, username: "older-name" },
      };
      const newer = {
        ...SAMPLE_ROW,
        id: "33333333-3333-4333-8333-333333333333",
        toUser: { id: 503, username: "newer-name" },
      };

      await importV1Rows(pglite.db, [newer, older]);

      const storedMembers = await pglite.db
        .select()
        .from(displayIdentities)
        .where(eq(displayIdentities.chatId, IMPORT_CHAT_ID));
      expect(storedMembers).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            userId: 501,
            displayName: "@giver",
          }),
          expect.objectContaining({
            userId: 503,
            displayName: "@newer-name",
          }),
        ]),
      );
    } finally {
      await closePgliteDb(pglite);
    }
  });

  it("updates an existing legacy Event and never duplicates or deletes rows", async () => {
    const pglite = await createPgliteDb();

    try {
      await importV1Rows(pglite.db, [SAMPLE_ROW]);
      await pglite.db.insert(events).values({
        type: "humor.add",
        chatId: IMPORT_CHAT_ID,
        actorId: 700,
        subjectId: 701,
        messageId: 99,
        createdAt: new Date(SAMPLE_ROW.createdAt),
      });

      const corrected = { ...SAMPLE_ROW, lolType: "minus" as const };
      const stats = await importV1Rows(pglite.db, [corrected]);

      expect(stats.events.updated).toBe(1);
      const stored = await pglite.db.select().from(events);
      expect(stored).toHaveLength(2);
      expect(
        stored.find((event) => event.legacyId === SAMPLE_ROW.id)?.type,
      ).toBe("karma.minus");
    } finally {
      await closePgliteDb(pglite);
    }
  });

  it("uses one earliest-dated Message for multiple Events", async () => {
    const pglite = await createPgliteDb();

    try {
      const earlier = {
        ...SAMPLE_ROW,
        id: "22222222-2222-4222-8222-222222222222",
        createdAt: SAMPLE_ROW.createdAt - 12_345,
        lolType: "lol" as const,
      };
      const stats = await importV1Rows(pglite.db, [SAMPLE_ROW, earlier]);

      expect(stats.events.inserted).toBe(2);
      expect(stats.messages.inserted).toBe(1);
      const storedMessages = await pglite.db.select().from(messageAuthors);
      expect(storedMessages).toEqual([
        expect.objectContaining({
          messageId: SAMPLE_ROW.toMessageId,
          messageDate: Math.floor(earlier.createdAt / 1_000),
        }),
      ]);
    } finally {
      await closePgliteDb(pglite);
    }
  });

  it("skips a conflicting Message author but still imports its Events", async () => {
    const pglite = await createPgliteDb();

    try {
      const conflict = {
        ...SAMPLE_ROW,
        id: "22222222-2222-4222-8222-222222222222",
        toUser: { id: 999, username: "other" },
      };
      const stats = await importV1Rows(pglite.db, [SAMPLE_ROW, conflict]);

      expect(stats.events.inserted).toBe(2);
      expect(stats.messages.skipped).toBe(1);
      await expect(pglite.db.select().from(messageAuthors)).resolves.toEqual(
        [],
      );
    } finally {
      await closePgliteDb(pglite);
    }
  });

  it("preserves an existing Message when its stored author conflicts", async () => {
    const pglite = await createPgliteDb();

    try {
      await pglite.db.insert(messageAuthors).values({
        chatId: IMPORT_CHAT_ID,
        messageId: SAMPLE_ROW.toMessageId,
        authorId: 999,
        authorIsBot: false,
        messageDate: Math.floor(SAMPLE_ROW.createdAt / 1_000),
      });
      const stats = await importV1Rows(pglite.db, [SAMPLE_ROW]);

      expect(stats.events.inserted).toBe(1);
      expect(stats.messages.skipped).toBe(1);
      await expect(pglite.db.select().from(messageAuthors)).resolves.toEqual([
        expect.objectContaining({ authorId: 999 }),
      ]);
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
