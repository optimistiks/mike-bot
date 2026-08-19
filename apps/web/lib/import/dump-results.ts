import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import type { AppDatabase } from "@/lib/db/runtime";
import { chatMembers, events } from "@/lib/db/schema";
import { queryLeaderboard } from "@/lib/leaderboard/query";
import { seasonForDate } from "@/lib/scoring/season";

import { parseV1LolRow, v1LolRowSchema, type V1LolRow } from "./v1-row";

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

  const leaderboards: Array<{
    chatId: number;
    season: { year: number; month: number };
    leaderboard: Awaited<ReturnType<typeof queryLeaderboard>>;
  }> = [];

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

function parseV1RowList(raw: unknown): V1LolRow[] {
  if (Array.isArray(raw)) {
    return raw.map((item) => parseV1LolRow(item));
  }

  if (
    typeof raw === "object" &&
    raw !== null &&
    "Items" in raw &&
    Array.isArray(raw.Items)
  ) {
    return raw.Items.map((item) => parseV1LolRow(item));
  }

  throw new Error(
    "IMPORT_V1_JSON must be a JSON array of v1 rows or { Items: [...] }",
  );
}

export async function loadV1RowsFromJson(
  filePath: string,
): Promise<V1LolRow[]> {
  const { readFile } = await import("node:fs/promises");
  const raw = JSON.parse(await readFile(filePath, "utf8")) as unknown;
  const rows = parseV1RowList(raw);

  for (const row of rows) {
    v1LolRowSchema.parse(row);
  }

  return rows;
}

export function filterV1RowsByChatId(
  rows: V1LolRow[],
  chatId: number | undefined,
): V1LolRow[] {
  if (chatId === undefined) {
    return rows;
  }

  return rows.filter((row) => row.chatId === chatId);
}
