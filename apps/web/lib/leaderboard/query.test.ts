import { describe, expect, it } from "vitest";

import { closePgliteDb, createPgliteDb } from "@/lib/db/pglite";
import { marks, messageAuthors } from "@/lib/db/schema";
import { PRIMARY_FIXTURE_CHAT_ID, resetAndSeedDatabase } from "@/lib/db/seed";

import { queryLeaderboard } from "./query";

describe("queryLeaderboard", () => {
  it("returns five sections with Display identities", async () => {
    const pglite = await createPgliteDb();

    try {
      await resetAndSeedDatabase(
        pglite.db,
        new Date("2026-08-15T12:00:00.000Z"),
      );
      const leaderboard = await queryLeaderboard(
        pglite.db,
        PRIMARY_FIXTURE_CHAT_ID,
        {
          year: 2026,
          month: 8,
        },
      );

      expect(leaderboard.chatId).toBe(PRIMARY_FIXTURE_CHAT_ID);
      expect(leaderboard.sections).toHaveLength(5);
      expect(leaderboard.sections.map((section) => section.title)).toEqual([
        "Уважаемые люди",
        "Юмористы",
        "На позитиве",
        "Хотят смеяться 5 минут",
        "Как же у них горит",
      ]);

      const entries = leaderboard.sections.flatMap(
        (section) => section.entries,
      );
      expect(entries.length).toBeGreaterThan(0);
      expect(
        entries.every((entry) => !entry.displayName.startsWith("User ")),
      ).toBe(true);
    } finally {
      await closePgliteDb(pglite);
    }
  });

  it("rejects Event types outside the database vocabulary", async () => {
    const pglite = await createPgliteDb();

    try {
      await expect(
        pglite.db.insert(marks).values({
          type: "future.unknown",
          chatId: PRIMARY_FIXTURE_CHAT_ID,
          actorId: 1,
          subjectId: 2,
          messageId: 3,
          source: "reaction",
          createdAt: new Date("2026-08-15T12:00:00.000Z"),
        }),
      ).rejects.toThrow();
    } finally {
      await closePgliteDb(pglite);
    }
  });

  it("credits a Mark to its Message's Season, not its own timestamp", async () => {
    const pglite = await createPgliteDb();

    try {
      await pglite.db.insert(messageAuthors).values({
        chatId: PRIMARY_FIXTURE_CHAT_ID,
        messageId: 40,
        authorId: 2,
        authorIsBot: false,
        messageDate: Math.floor(
          new Date("2026-01-31T20:00:00.000Z").getTime() / 1000,
        ),
      });
      await pglite.db.insert(marks).values({
        type: "karma.plus",
        chatId: PRIMARY_FIXTURE_CHAT_ID,
        actorId: 1,
        subjectId: 2,
        messageId: 40,
        source: "reaction",
        createdAt: new Date("2026-01-31T21:09:59.000Z"),
      });

      const january = await queryLeaderboard(
        pglite.db,
        PRIMARY_FIXTURE_CHAT_ID,
        { year: 2026, month: 1 },
      );
      const february = await queryLeaderboard(
        pglite.db,
        PRIMARY_FIXTURE_CHAT_ID,
        { year: 2026, month: 2 },
      );

      expect(january.sections[0]?.entries).toEqual([
        expect.objectContaining({ userId: 2, score: 1 }),
      ]);
      expect(february.sections[0]?.entries).toEqual([]);
    } finally {
      await closePgliteDb(pglite);
    }
  });

  it("credits an Imported Mark like any other, by its Message's Season", async () => {
    const pglite = await createPgliteDb();

    try {
      // The import writes the Message post time as the earliest v1 Mark on it,
      // so an Imported Mark needs no special case to land in the right Season.
      await pglite.db.insert(messageAuthors).values({
        chatId: PRIMARY_FIXTURE_CHAT_ID,
        messageId: 42,
        authorId: 2,
        authorIsBot: false,
        messageDate: Math.floor(
          new Date("2026-01-15T12:00:00.000Z").getTime() / 1000,
        ),
      });
      await pglite.db.insert(marks).values({
        type: "karma.plus",
        chatId: PRIMARY_FIXTURE_CHAT_ID,
        actorId: 1,
        subjectId: 2,
        messageId: 42,
        source: "reply",
        createdAt: new Date("2026-01-15T12:00:00.000Z"),
        legacyId: "11111111-1111-4111-8111-111111111111",
      });

      const january = await queryLeaderboard(
        pglite.db,
        PRIMARY_FIXTURE_CHAT_ID,
        { year: 2026, month: 1 },
      );

      expect(january.sections[0]?.entries).toEqual([
        expect.objectContaining({ userId: 2, score: 1 }),
      ]);
    } finally {
      await closePgliteDb(pglite);
    }
  });

  it("credits every Imported Mark on one Message to that Message's Season", async () => {
    const pglite = await createPgliteDb();

    try {
      // v1 allowed repeat marking, so a Message can carry Marks from two
      // calendar months. The Message's post time is the earliest of them, and
      // every Mark on it follows that — including the later one, which v1
      // counted in February.
      await pglite.db.insert(messageAuthors).values({
        chatId: PRIMARY_FIXTURE_CHAT_ID,
        messageId: 43,
        authorId: 2,
        authorIsBot: false,
        messageDate: Math.floor(
          new Date("2026-01-30T12:00:00.000Z").getTime() / 1000,
        ),
      });
      await pglite.db.insert(marks).values([
        {
          type: "karma.plus",
          chatId: PRIMARY_FIXTURE_CHAT_ID,
          actorId: 1,
          subjectId: 2,
          messageId: 43,
          source: "reply",
          createdAt: new Date("2026-01-30T12:00:00.000Z"),
          legacyId: "22222222-2222-4222-8222-222222222222",
        },
        {
          type: "karma.plus",
          chatId: PRIMARY_FIXTURE_CHAT_ID,
          actorId: 3,
          subjectId: 2,
          messageId: 43,
          source: "reply",
          createdAt: new Date("2026-02-03T12:00:00.000Z"),
          legacyId: "33333333-3333-4333-8333-333333333333",
        },
      ]);

      const january = await queryLeaderboard(
        pglite.db,
        PRIMARY_FIXTURE_CHAT_ID,
        { year: 2026, month: 1 },
      );
      const february = await queryLeaderboard(
        pglite.db,
        PRIMARY_FIXTURE_CHAT_ID,
        { year: 2026, month: 2 },
      );

      expect(january.sections[0]?.entries).toEqual([
        expect.objectContaining({ userId: 2, score: 2 }),
      ]);
      expect(february.sections[0]?.entries).toEqual([]);
    } finally {
      await closePgliteDb(pglite);
    }
  });
});
