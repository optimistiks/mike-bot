import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { and, eq } from "drizzle-orm";

import type { AppDatabase } from "@/lib/db/runtime";
import { displayIdentities, marks, messageAuthors } from "@/lib/db/schema";
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
  const markRows = await db
    .select({ mark: marks, messageDate: messageAuthors.messageDate })
    .from(marks)
    .leftJoin(
      messageAuthors,
      and(
        eq(marks.chatId, messageAuthors.chatId),
        eq(marks.messageId, messageAuthors.messageId),
      ),
    );
  const identityRows = await db.select().from(displayIdentities);
  const messageRows = await db.select().from(messageAuthors);

  await writeJsonFile(
    options.outDir,
    "marks.json",
    markRows.map((row) => row.mark),
  );
  await writeJsonFile(options.outDir, "display_identities.json", identityRows);
  await writeJsonFile(options.outDir, "messages.json", messageRows);

  const chatIds =
    options.chatIds ??
    [...new Set(markRows.map((row) => row.mark.chatId))].toSorted(
      (a, b) => a - b,
    );

  const leaderboards: {
    chatId: number;
    season: { year: number; month: number };
    leaderboard: Awaited<ReturnType<typeof queryLeaderboard>>;
  }[] = [];

  for (const chatId of chatIds) {
    const seasons = new Map<string, { year: number; month: number }>();

    for (const row of markRows) {
      if (row.mark.chatId !== chatId) {
        continue;
      }

      if (row.messageDate === null) {
        continue;
      }

      const season = seasonForDate(new Date(row.messageDate * 1000));
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
    path.join(options.outDir, "marks.json"),
    path.join(options.outDir, "display_identities.json"),
    path.join(options.outDir, "messages.json"),
    path.join(options.outDir, "leaderboards.json"),
  ];
}
