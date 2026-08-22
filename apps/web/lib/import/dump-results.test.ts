import { describe, expect, it } from "vitest";

import { closePgliteDb, createPgliteDb } from "@/lib/db/pglite";

import { dumpImportResults } from "./dump-results";
import { buildImportSql, splitStatements } from "./sql-file";

const SAMPLE_ROW = {
  id: "11111111-1111-4111-8111-111111111111",
  createdAt: Date.parse("2026-07-31T21:00:00.000Z"),
  lolType: "plus" as const,
  fromUser: { id: 501, username: "giver" },
  toUser: { id: 502, username: "receiver" },
  chatId: -100_999_888,
  toMessageId: 77,
};

describe("dumpImportResults", () => {
  it("writes Events, Messages, Display identities, and leaderboard files", async () => {
    const pglite = await createPgliteDb();
    const outDir = "/tmp/mike-bot-import-dump-test";

    try {
      for (const statement of splitStatements(
        buildImportSql([SAMPLE_ROW]).sql,
      )) {
        await pglite.client.query(statement);
      }
      const files = await dumpImportResults(pglite.db, { outDir });

      expect(files).toEqual([
        `${outDir}/events.json`,
        `${outDir}/display_identities.json`,
        `${outDir}/messages.json`,
        `${outDir}/leaderboards.json`,
      ]);

      const { readFile } = await import("node:fs/promises");
      const eventsJson = JSON.parse(
        await readFile(`${outDir}/events.json`, "utf8"),
      ) as { type: string; legacyId: string | null }[];
      const leaderboardsJson = JSON.parse(
        await readFile(`${outDir}/leaderboards.json`, "utf8"),
      ) as {
        chatId: number;
        season: { year: number; month: number };
        leaderboard: { sections: { title: string }[] };
      }[];

      expect(eventsJson).toHaveLength(1);
      expect(eventsJson[0]?.type).toBe("karma.plus");
      expect(leaderboardsJson[0]?.season).toEqual({ year: 2026, month: 8 });
      expect(leaderboardsJson[0]?.leaderboard.sections).toHaveLength(5);
    } finally {
      await closePgliteDb(pglite);
    }
  });
});
