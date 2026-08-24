import { and, eq, gte, isNull, lt } from "drizzle-orm";

import type { AppDatabase } from "@/lib/db/runtime";
import { displayIdentities, marks, messageAuthors } from "@/lib/db/schema";
import { markTypeSchema } from "@/lib/domain/mark";
import {
  aggregateLeaderboard,
  getCurrentSeason,
  seasonDateRangeInSeconds,
  seasonForDate,
  yearDateRangeInSeconds,
  type Season,
} from "@/lib/scoring";

import type { LeaderboardPeriod, LeaderboardResponse } from "./schema";

/**
 * One Leaderboard, for one Leaderboard period.
 *
 * A Mark belongs to the Season of its Message's post time (ADR-0017), so a
 * period is a range over those post times and a year is simply a wider one —
 * one read and one aggregation, not twelve of each stitched back together.
 * Ranking, flair, and section order all live in the scoring module.
 */
export async function queryLeaderboard(
  db: AppDatabase,
  chatId: number,
  period: LeaderboardPeriod | Season,
): Promise<LeaderboardResponse> {
  const resolved: LeaderboardPeriod =
    "kind" in period ? period : { kind: "season", ...period };
  const range =
    resolved.kind === "year"
      ? yearDateRangeInSeconds(resolved.year)
      : seasonDateRangeInSeconds(resolved);

  const [markRows, identityRows] = await Promise.all([
    db
      .select({
        type: marks.type,
        actorId: marks.actorId,
        subjectId: marks.subjectId,
      })
      .from(marks)
      .innerJoin(
        messageAuthors,
        and(
          eq(marks.chatId, messageAuthors.chatId),
          eq(marks.messageId, messageAuthors.messageId),
        ),
      )
      .where(
        and(
          eq(marks.chatId, chatId),
          isNull(marks.undoneAt),
          gte(messageAuthors.messageDate, range.start),
          lt(messageAuthors.messageDate, range.end),
        ),
      ),
    db
      .select()
      .from(displayIdentities)
      .where(eq(displayIdentities.chatId, chatId)),
  ]);

  const displayNames = new Map(
    identityRows.map((identity) => [identity.userId, identity.displayName]),
  );
  const sections = aggregateLeaderboard(
    markRows.map((row) => ({
      type: markTypeSchema.parse(row.type),
      actorId: row.actorId,
      subjectId: row.subjectId,
    })),
  );

  return {
    chatId,
    period: resolved,
    sections: sections.map((section) => ({
      ...section,
      entries: section.entries.map((entry) => ({
        ...entry,
        displayName:
          displayNames.get(entry.userId) ?? `User ${String(entry.userId)}`,
      })),
    })),
  };
}

export async function queryAvailableSeasons(
  db: AppDatabase,
  chatId: number,
): Promise<Season[]> {
  const rows = await db
    .select({ messageDate: messageAuthors.messageDate })
    .from(marks)
    .innerJoin(
      messageAuthors,
      and(
        eq(marks.chatId, messageAuthors.chatId),
        eq(marks.messageId, messageAuthors.messageId),
      ),
    )
    .where(and(eq(marks.chatId, chatId), isNull(marks.undoneAt)));

  const seasons = new Map<string, Season>();
  for (const row of rows) {
    const season = seasonForDate(new Date(row.messageDate * 1_000));
    seasons.set(`${String(season.year)}-${String(season.month)}`, season);
  }

  return [...seasons.values()].toSorted(
    (left, right) => left.year - right.year || left.month - right.month,
  );
}

export function resolvePeriod(query: {
  year?: number;
  month?: number;
}): LeaderboardPeriod {
  if (query.year !== undefined && query.month !== undefined) {
    return { kind: "season", year: query.year, month: query.month };
  }
  if (query.year !== undefined) return { kind: "year", year: query.year };

  return { kind: "season", ...getCurrentSeason() };
}
