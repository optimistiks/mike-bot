import { eq } from 'drizzle-orm';

import type { AppDatabase } from '@/lib/db/runtime';
import { chatMembers, events } from '@/lib/db/schema';
import type { EventType } from '@/lib/domain/event';
import {
  aggregateLeaderboard,
  getCurrentSeason,
  type Season,
} from '@/lib/scoring';

import type { LeaderboardResponse } from './schema';

export async function queryLeaderboard(
  db: AppDatabase,
  chatId: number,
  season: Season,
): Promise<LeaderboardResponse> {
  const [eventRows, memberRows] = await Promise.all([
    db.select().from(events).where(eq(events.chatId, chatId)),
    db.select().from(chatMembers).where(eq(chatMembers.chatId, chatId)),
  ]);

  const displayNames = new Map(
    memberRows.map((member) => [member.userId, member.displayName]),
  );

  const aggregated = aggregateLeaderboard(
    eventRows.map((row) => ({
      type: row.type as EventType,
      actorId: row.actorId,
      subjectId: row.subjectId,
      createdAt: row.createdAt,
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
        displayName: displayNames.get(entry.userId) ?? `User ${entry.userId}`,
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
