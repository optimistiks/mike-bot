import { getCurrentSeason, isEventInSeason } from "./season";
import { eventTypeToContributions } from "./contributions";
import type {
  AggregatedLeaderboard,
  LeaderboardEntry,
  LeaderboardSection,
  ScoringEvent,
} from "./types";
import type { Season } from "./season";

const SECTIONS = [
  { id: "karma-received", title: "Уважаемые люди", bucket: "karmaReceived" },
  { id: "humor-received", title: "Юмористы", bucket: "humorReceived" },
  { id: "karma-plus-given", title: "Поставили +", bucket: "karmaPlusGiven" },
  { id: "karma-minus-given", title: "Поставили −", bucket: "karmaMinusGiven" },
  { id: "humor-given", title: "Поставили лол", bucket: "humorGiven" },
] as const;

type BucketKey = (typeof SECTIONS)[number]["bucket"];

function accumulateScores(
  events: ScoringEvent[],
  season: Season,
): Record<BucketKey, Map<number, number>> {
  const scores: Record<BucketKey, Map<number, number>> = {
    karmaReceived: new Map(),
    humorReceived: new Map(),
    karmaPlusGiven: new Map(),
    karmaMinusGiven: new Map(),
    humorGiven: new Map(),
  };

  for (const scoringEvent of events) {
    if (!isEventInSeason(scoringEvent.createdAt, season)) {
      continue;
    }

    const contributions = eventTypeToContributions(scoringEvent.type);

    addToBucket(
      scores.karmaReceived,
      scoringEvent.subjectId,
      contributions.karmaReceived,
    );
    addToBucket(
      scores.humorReceived,
      scoringEvent.subjectId,
      contributions.humorReceived,
    );
    addToBucket(
      scores.karmaPlusGiven,
      scoringEvent.actorId,
      contributions.karmaPlusGiven,
    );
    addToBucket(
      scores.karmaMinusGiven,
      scoringEvent.actorId,
      contributions.karmaMinusGiven,
    );
    addToBucket(
      scores.humorGiven,
      scoringEvent.actorId,
      contributions.humorGiven,
    );
  }

  return scores;
}

function addToBucket(
  bucket: Map<number, number>,
  userId: number,
  delta: number,
): void {
  if (delta === 0) {
    return;
  }

  bucket.set(userId, (bucket.get(userId) ?? 0) + delta);
}

function rankBucket(bucket: Map<number, number>): LeaderboardEntry[] {
  const ranked = [...bucket.entries()]
    .filter(([, score]) => score !== 0)
    .sort((left, right) => {
      if (right[1] !== left[1]) {
        return right[1] - left[1];
      }

      return left[0] - right[0];
    })
    .map(([userId, score]) => ({ userId, score }));

  if (ranked.length === 0) {
    return [];
  }

  return ranked.map((entry, index) => ({
    ...entry,
    isCrown: index === 0,
    isChicken: index === ranked.length - 1 && ranked.length > 1,
  }));
}

export function aggregateLeaderboard(
  events: ScoringEvent[],
  season: Season,
  now = new Date(),
): AggregatedLeaderboard {
  const scores = accumulateScores(events, season);
  const currentSeason = getCurrentSeason(now);

  const sections: LeaderboardSection[] = SECTIONS.map((section) => ({
    id: section.id,
    title: section.title,
    entries: rankBucket(scores[section.bucket]),
  }));

  return {
    season,
    isCurrentSeason:
      season.year === currentSeason.year &&
      season.month === currentSeason.month,
    sections,
  };
}
