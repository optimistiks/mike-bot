import { describe, expect, it } from "vitest";

import { closePgliteDb, createPgliteDb } from "@/lib/db/pglite";
import { PRIMARY_FIXTURE_CHAT_ID, resetAndSeedDatabase } from "@/lib/db/seed";

import { queryLeaderboard } from "./query";

describe("queryLeaderboard", () => {
  it("returns five sections with display names joined from chat_members", async () => {
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
        "Поставили +",
        "Поставили −",
        "Поставили лол",
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
});
