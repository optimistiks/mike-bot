import { describe, expect, it } from "vitest";

import { closePgliteDb, createPgliteDb } from "@/lib/db/pglite";

import { queryLeaderboard } from "./query";
import { FIXTURE_CHAT_ID, seedLeaderboardFixture } from "./seed";

describe("queryLeaderboard", () => {
  it("returns five sections with display names joined from chat_members", async () => {
    const pglite = await createPgliteDb();

    try {
      await seedLeaderboardFixture(pglite.db);
      const leaderboard = await queryLeaderboard(pglite.db, FIXTURE_CHAT_ID, {
        year: 2026,
        month: 8,
      });

      expect(leaderboard.chatId).toBe(FIXTURE_CHAT_ID);
      expect(leaderboard.sections).toHaveLength(5);
      expect(leaderboard.sections.map((section) => section.title)).toEqual([
        "Уважаемые люди",
        "Юмористы",
        "Поставили +",
        "Поставили −",
        "Поставили лол",
      ]);

      const karmaReceived = leaderboard.sections[0]?.entries ?? [];
      expect(karmaReceived[0]).toMatchObject({
        displayName: "@bob",
        score: 2,
        isCrown: true,
      });

      const humorReceived = leaderboard.sections[1]?.entries ?? [];
      expect(humorReceived).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ displayName: "@bob", score: 1 }),
          expect.objectContaining({ displayName: "@carol", score: 1 }),
        ]),
      );
    } finally {
      await closePgliteDb(pglite);
    }
  });
});
