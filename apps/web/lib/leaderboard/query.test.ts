import { describe, expect, it } from "vitest";

import { closePgliteDb, createPgliteDb } from "@/lib/db/pglite";
import { events, messageAuthors } from "@/lib/db/schema";
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

  it("rejects Event types outside the application vocabulary", async () => {
    const pglite = await createPgliteDb();

    try {
      await pglite.db.insert(events).values({
        type: "future.unknown",
        chatId: PRIMARY_FIXTURE_CHAT_ID,
        actorId: 1,
        subjectId: 2,
        messageId: 3,
        createdAt: new Date("2026-08-15T12:00:00.000Z"),
      });
      await pglite.db.insert(messageAuthors).values({
        chatId: PRIMARY_FIXTURE_CHAT_ID,
        messageId: 3,
        authorId: 2,
        authorIsBot: false,
        messageDate: Math.floor(
          new Date("2026-08-15T11:00:00.000Z").getTime() / 1000,
        ),
      });

      await expect(
        queryLeaderboard(pglite.db, PRIMARY_FIXTURE_CHAT_ID, {
          year: 2026,
          month: 8,
        }),
      ).rejects.toThrow();
    } finally {
      await closePgliteDb(pglite);
    }
  });

  it("credits a grace-window action to the message Season", async () => {
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
      await pglite.db.insert(events).values({
        type: "karma.plus",
        chatId: PRIMARY_FIXTURE_CHAT_ID,
        actorId: 1,
        subjectId: 2,
        messageId: 40,
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

  it("does not project a v2 Event at or after the Season cutoff", async () => {
    const pglite = await createPgliteDb();

    try {
      await pglite.db.insert(messageAuthors).values({
        chatId: PRIMARY_FIXTURE_CHAT_ID,
        messageId: 41,
        authorId: 2,
        authorIsBot: false,
        messageDate: Math.floor(
          new Date("2026-01-31T20:00:00.000Z").getTime() / 1000,
        ),
      });
      await pglite.db.insert(events).values({
        type: "karma.plus",
        chatId: PRIMARY_FIXTURE_CHAT_ID,
        actorId: 1,
        subjectId: 2,
        messageId: 41,
        createdAt: new Date("2026-01-31T21:10:00.000Z"),
      });

      const january = await queryLeaderboard(
        pglite.db,
        PRIMARY_FIXTURE_CHAT_ID,
        { year: 2026, month: 1 },
      );

      expect(january.sections[0]?.entries).toEqual([]);
    } finally {
      await closePgliteDb(pglite);
    }
  });

  it("credits imported v1 Events by their action timestamp", async () => {
    const pglite = await createPgliteDb();

    try {
      await pglite.db.insert(events).values({
        type: "karma.plus",
        chatId: PRIMARY_FIXTURE_CHAT_ID,
        actorId: 1,
        subjectId: 2,
        messageId: 42,
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
});
