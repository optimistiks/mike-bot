import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { and, eq } from "drizzle-orm";

import type { AppDatabase } from "@/lib/db/runtime";
import { displayIdentities, events, messageAuthors } from "@/lib/db/schema";
import { queryLeaderboard } from "@/lib/leaderboard/query";
import { creditedSeasonForReaction, seasonForDate } from "@/lib/scoring/season";

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
  const eventRows = await db
    .select({ event: events, messageDate: messageAuthors.messageDate })
    .from(events)
    .leftJoin(
      messageAuthors,
      and(
        eq(events.chatId, messageAuthors.chatId),
        eq(events.messageId, messageAuthors.messageId),
      ),
    );
  const identityRows = await db.select().from(displayIdentities);
  const messageRows = await db.select().from(messageAuthors);

  await writeJsonFile(
    options.outDir,
    "events.json",
    eventRows.map((row) => row.event),
  );
  await writeJsonFile(options.outDir, "display_identities.json", identityRows);
  await writeJsonFile(options.outDir, "messages.json", messageRows);

  const chatIds =
    options.chatIds ??
    [...new Set(eventRows.map((row) => row.event.chatId))].toSorted(
      (a, b) => a - b,
    );

  const leaderboards: {
    chatId: number;
    season: { year: number; month: number };
    leaderboard: Awaited<ReturnType<typeof queryLeaderboard>>;
  }[] = [];

  for (const chatId of chatIds) {
    const seasons = new Map<string, { year: number; month: number }>();

    for (const row of eventRows) {
      if (row.event.chatId !== chatId) {
        continue;
      }

      const season =
        row.event.legacyId !== null
          ? seasonForDate(row.event.createdAt)
          : row.messageDate === null
            ? null
            : creditedSeasonForReaction(
                new Date(row.messageDate * 1000),
                row.event.createdAt,
              );
      if (season === null) {
        continue;
      }
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
    path.join(options.outDir, "display_identities.json"),
    path.join(options.outDir, "messages.json"),
    path.join(options.outDir, "leaderboards.json"),
  ];
}
