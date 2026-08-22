import { asc } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { seasonForDate } from "@/lib/scoring";
import { queryLeaderboard } from "@/lib/leaderboard/query";

import { closePgliteDb, createPgliteDb } from "./pglite";
import {
  FORBIDDEN_PERSONA_ID,
  PRIMARY_FIXTURE_CHAT_ID,
  REGISTERED_PERSONA_ID,
  SECONDARY_FIXTURE_CHAT_ID,
  UNREGISTERED_PERSONA_ID,
  resetAndSeedDatabase,
} from "./seed";
import {
  displayIdentities,
  events,
  processedUpdates,
  registrations,
} from "./schema";

async function fixtureSnapshot(
  db: Awaited<ReturnType<typeof createPgliteDb>>["db"],
) {
  return {
    displayIdentities: await db
      .select()
      .from(displayIdentities)
      .orderBy(asc(displayIdentities.chatId), asc(displayIdentities.userId)),
    registrations: await db
      .select()
      .from(registrations)
      .orderBy(asc(registrations.chatId), asc(registrations.userId)),
    events: await db.select().from(events).orderBy(asc(events.id)),
    processedUpdates: await db.select().from(processedUpdates),
  };
}

async function scoreSnapshot(
  db: Awaited<ReturnType<typeof createPgliteDb>>["db"],
  season: { year: number; month: number },
) {
  const leaderboard = await queryLeaderboard(
    db,
    PRIMARY_FIXTURE_CHAT_ID,
    season,
  );

  return leaderboard.sections.map((section) => ({
    id: section.id,
    entries: section.entries.map(({ displayName, score }) => ({
      displayName,
      score,
    })),
  }));
}

describe("resetAndSeedDatabase", () => {
  it("resets to the same deterministic fixture on every run", async () => {
    const pglite = await createPgliteDb();
    const now = new Date("2026-08-31T21:00:00.000Z");

    try {
      await resetAndSeedDatabase(pglite.db, now);
      const first = await fixtureSnapshot(pglite.db);
      const firstScores = await scoreSnapshot(pglite.db, {
        year: 2026,
        month: 9,
      });

      await pglite.db.insert(processedUpdates).values({ updateId: 999 });
      await pglite.db.insert(events).values({
        type: "karma.plus",
        chatId: -999,
        actorId: 1,
        subjectId: 2,
        messageId: 3,
        createdAt: now,
      });

      await resetAndSeedDatabase(pglite.db, now);
      const second = await fixtureSnapshot(pglite.db);
      const secondScores = await scoreSnapshot(pglite.db, {
        year: 2026,
        month: 9,
      });

      expect(second).toEqual(first);
      expect(secondScores).toEqual(firstScores);
      expect(secondScores).toEqual([
        {
          id: "karma-received",
          entries: [
            { displayName: "@bob", score: 2 },
            { displayName: "@carol", score: -1 },
          ],
        },
        {
          id: "humor-received",
          entries: [
            { displayName: "@bob", score: 1 },
            { displayName: "@carol", score: 1 },
          ],
        },
        {
          id: "karma-plus-given",
          entries: [
            { displayName: "@alice", score: 1 },
            { displayName: "@carol", score: 1 },
          ],
        },
        {
          id: "humor-given",
          entries: [
            { displayName: "@alice", score: 1 },
            { displayName: "@bob", score: 1 },
          ],
        },
        {
          id: "karma-minus-given",
          entries: [{ displayName: "@alice", score: 1 }],
        },
      ]);
      expect(second.displayIdentities).toHaveLength(5);
      expect(second.registrations).toEqual([
        { chatId: SECONDARY_FIXTURE_CHAT_ID, userId: FORBIDDEN_PERSONA_ID },
        { chatId: PRIMARY_FIXTURE_CHAT_ID, userId: REGISTERED_PERSONA_ID },
      ]);
      expect(
        second.displayIdentities.some(
          (member) => member.userId === UNREGISTERED_PERSONA_ID,
        ),
      ).toBe(true);
      expect(second.events).toHaveLength(10);
      expect(second.processedUpdates).toEqual([]);
    } finally {
      await closePgliteDb(pglite);
    }
  });

  it("places Events in the Current and previous Moscow Seasons", async () => {
    const pglite = await createPgliteDb();
    const now = new Date("2026-08-31T21:00:00.000Z");

    try {
      await resetAndSeedDatabase(pglite.db, now);
      const seededEvents = await pglite.db.select().from(events);
      const seasons = new Set(
        seededEvents.map((event) => {
          const season = seasonForDate(event.createdAt);
          return `${String(season.year)}-${String(season.month)}`;
        }),
      );

      expect(seasons).toEqual(new Set(["2026-8", "2026-9"]));
    } finally {
      await closePgliteDb(pglite);
    }
  });
});
