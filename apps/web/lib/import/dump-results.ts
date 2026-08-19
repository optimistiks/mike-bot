import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import type { AppDatabase } from "@/lib/db/runtime";
import { chatMembers, events } from "@/lib/db/schema";
import { queryLeaderboard } from "@/lib/leaderboard/query";
import { seasonForDate } from "@/lib/scoring/season";

export interface DumpImportResultsOptions {
  outDir: string;
  chatIds?: number[];
}

function seasonKey(season: { year: number; month: number }): string {
  return `${String(season.year)}-${String(season.month).padStart(2, "0")}`;
}

async function writeJsonFile(
  outDir: string,
  filename: string,
  data: unknown,
): Promise<void> {
  await mkdir(outDir, { recursive: true });
  await writeFile(
    path.join(outDir, filename),
    `${JSON.stringify(data, null, 2)}\n`,
    "utf8",
  );
}

export async function dumpImportResults(
  db: AppDatabase,
  options: DumpImportResultsOptions,
): Promise<string[]> {
  const eventRows = await db.select().from(events);
  const memberRows = await db.select().from(chatMembers);

  await writeJsonFile(options.outDir, "events.json", eventRows);
  await writeJsonFile(options.outDir, "chat_members.json", memberRows);

  const chatIds =
    options.chatIds ??
    [...new Set(eventRows.map((row) => row.chatId))].toSorted((a, b) => a - b);

  const leaderboards: {
    chatId: number;
    season: { year: number; month: number };
    leaderboard: Awaited<ReturnType<typeof queryLeaderboard>>;
  }[] = [];

  for (const chatId of chatIds) {
    const seasons = new Map<string, { year: number; month: number }>();

    for (const row of eventRows) {
      if (row.chatId !== chatId) {
        continue;
      }

      const season = seasonForDate(row.createdAt);
      seasons.set(seasonKey(season), season);
    }

    for (const season of seasons.values()) {
      leaderboards.push({
        chatId,
        season,
        leaderboard: await queryLeaderboard(db, chatId, season),
      });
    }
  }

  await writeJsonFile(options.outDir, "leaderboards.json", leaderboards);

  return [
    path.join(options.outDir, "events.json"),
    path.join(options.outDir, "chat_members.json"),
    path.join(options.outDir, "leaderboards.json"),
  ];
}
