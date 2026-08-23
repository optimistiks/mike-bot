import { and, eq, gte, isNotNull, isNull, lt, or } from "drizzle-orm";

import type { AppDatabase } from "@/lib/db/runtime";
import { displayIdentities, marks, messageAuthors } from "@/lib/db/schema";
import { markTypeSchema } from "@/lib/domain/mark";
import {
  aggregateLeaderboard,
  creditedSeasonForReaction,
  getCurrentSeason,
  SEASON_GRACE_PERIOD_MS,
  seasonDateRange,
  seasonForDate,
  type Season,
} from "@/lib/scoring";

import type {
  LeaderboardEntry,
  LeaderboardPeriod,
  LeaderboardResponse,
} from "./schema";

function rankAnnualEntries(
  entries: Map<number, { displayName: string; score: number }>,
): LeaderboardEntry[] {
  const ranked = [...entries.entries()]
    .filter(([, entry]) => entry.score !== 0)
    .sort((left, right) => {
      if (right[1].score !== left[1].score) {
        return right[1].score - left[1].score;
      }
      return left[0] - right[0];
    });

  const highestScore = ranked[0]?.[1].score;
  const lowestScore = ranked.at(-1)?.[1].score;

  return ranked.map(([userId, entry]) => ({
    userId,
    displayName: entry.displayName,
    score: entry.score,
    isCrown: entry.score === highestScore,
    isChicken: highestScore !== lowestScore && entry.score === lowestScore,
  }));
}

async function querySeasonLeaderboard(
  db: AppDatabase,
  chatId: number,
  season: Season,
): Promise<LeaderboardResponse> {
  const range = seasonDateRange(season);
  const startSeconds = Math.floor(range.start.getTime() / 1000);
  const endSeconds = Math.floor(range.end.getTime() / 1000);
  const closesAt = new Date(range.end.getTime() + SEASON_GRACE_PERIOD_MS);
  const [markRows, identityRows] = await Promise.all([
    db
      .select({
        type: marks.type,
        actorId: marks.actorId,
        subjectId: marks.subjectId,
      })
      .from(marks)
      .leftJoin(
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
          or(
            and(
              isNotNull(marks.legacyId),
              gte(marks.createdAt, range.start),
              lt(marks.createdAt, range.end),
            ),
            and(
              isNull(marks.legacyId),
              gte(messageAuthors.messageDate, startSeconds),
              lt(messageAuthors.messageDate, endSeconds),
              lt(marks.createdAt, closesAt),
            ),
          ),
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
  const aggregated = aggregateLeaderboard(
    markRows.map((row) => ({
      type: markTypeSchema.parse(row.type),
      actorId: row.actorId,
      subjectId: row.subjectId,
      season,
    })),
    season,
  );

  return {
    chatId,
    period: { kind: "season", ...season },
    sections: aggregated.sections.map((section) => ({
      id: section.id,
      title: section.title,
      entries: section.entries.map((entry) => ({
        ...entry,
        displayName:
          displayNames.get(entry.userId) ?? `User ${String(entry.userId)}`,
      })),
    })),
  };
}

async function queryYearLeaderboard(
  db: AppDatabase,
  chatId: number,
  year: number,
): Promise<LeaderboardResponse> {
  const months = await Promise.all(
    Array.from({ length: 12 }, (_, index) =>
      querySeasonLeaderboard(db, chatId, { year, month: index + 1 }),
    ),
  );
  const templateSections = months[0]?.sections ?? [];

  return {
    chatId,
    period: { kind: "year", year },
    sections: templateSections.map((template) => {
      const totals = new Map<number, { displayName: string; score: number }>();

      for (const month of months) {
        const section = month.sections.find(({ id }) => id === template.id);
        for (const entry of section?.entries ?? []) {
          const current = totals.get(entry.userId);
          totals.set(entry.userId, {
            displayName: entry.displayName,
            score: (current?.score ?? 0) + entry.score,
          });
        }
      }

      return { ...template, entries: rankAnnualEntries(totals) };
    }),
  };
}

export async function queryLeaderboard(
  db: AppDatabase,
  chatId: number,
  period: LeaderboardPeriod | Season,
): Promise<LeaderboardResponse> {
  if (!("kind" in period) || period.kind === "season") {
    return querySeasonLeaderboard(db, chatId, {
      year: period.year,
      month: period.month,
    });
  }
  return queryYearLeaderboard(db, chatId, period.year);
}

export async function queryAvailableSeasons(
  db: AppDatabase,
  chatId: number,
): Promise<Season[]> {
  const rows = await db
    .select({
      legacyId: marks.legacyId,
      createdAt: marks.createdAt,
      messageDate: messageAuthors.messageDate,
    })
    .from(marks)
    .leftJoin(
      messageAuthors,
      and(
        eq(marks.chatId, messageAuthors.chatId),
        eq(marks.messageId, messageAuthors.messageId),
      ),
    )
    .where(and(eq(marks.chatId, chatId), isNull(marks.undoneAt)));

  const seasons = new Map<string, Season>();
  for (const row of rows) {
    const season = row.legacyId
      ? seasonForDate(row.createdAt)
      : row.messageDate === null
        ? null
        : creditedSeasonForReaction(
            new Date(row.messageDate * 1_000),
            row.createdAt,
          );
    if (season) {
      seasons.set(`${String(season.year)}-${String(season.month)}`, season);
    }
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
