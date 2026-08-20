import { and, eq, gte, isNotNull, isNull, lt, or } from "drizzle-orm";

import type { AppDatabase } from "@/lib/db/runtime";
import { displayIdentities, events, messageAuthors } from "@/lib/db/schema";
import { eventTypeSchema } from "@/lib/domain/event";
import {
  aggregateLeaderboard,
  getCurrentSeason,
  SEASON_GRACE_PERIOD_MS,
  seasonDateRange,
  type Season,
} from "@/lib/scoring";

import type { LeaderboardResponse } from "./schema";

export async function queryLeaderboard(
  db: AppDatabase,
  chatId: number,
  season: Season,
): Promise<LeaderboardResponse> {
  const range = seasonDateRange(season);
  const startSeconds = Math.floor(range.start.getTime() / 1000);
  const endSeconds = Math.floor(range.end.getTime() / 1000);
  const closesAt = new Date(range.end.getTime() + SEASON_GRACE_PERIOD_MS);
  const [eventRows, identityRows] = await Promise.all([
    db
      .select({
        type: events.type,
        actorId: events.actorId,
        subjectId: events.subjectId,
      })
      .from(events)
      .leftJoin(
        messageAuthors,
        and(
          eq(events.chatId, messageAuthors.chatId),
          eq(events.messageId, messageAuthors.messageId),
        ),
      )
      .where(
        and(
          eq(events.chatId, chatId),
          or(
            and(
              isNotNull(events.legacyId),
              gte(events.createdAt, range.start),
              lt(events.createdAt, range.end),
            ),
            and(
              isNull(events.legacyId),
              gte(messageAuthors.messageDate, startSeconds),
              lt(messageAuthors.messageDate, endSeconds),
              lt(events.createdAt, closesAt),
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
    eventRows.map((row) => ({
      type: eventTypeSchema.parse(row.type),
      actorId: row.actorId,
      subjectId: row.subjectId,
      season,
    })),
    season,
  );

  return {
    chatId,
    season: aggregated.season,
    isCurrentSeason: aggregated.isCurrentSeason,
    sections: aggregated.sections.map((section) => ({
      id: section.id,
      title: section.title,
      entries: section.entries.map((entry) => ({
        userId: entry.userId,
        displayName:
          displayNames.get(entry.userId) ?? `User ${String(entry.userId)}`,
        score: entry.score,
        isCrown: entry.isCrown,
        isChicken: entry.isChicken,
      })),
    })),
  };
}

export function resolveSeason(query: {
  year?: number;
  month?: number;
}): Season {
  if (query.year !== undefined && query.month !== undefined) {
    return { year: query.year, month: query.month };
  }

  return getCurrentSeason();
}
