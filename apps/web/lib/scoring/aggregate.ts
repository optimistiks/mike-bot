import { getCurrentSeason, seasonsEqual } from "./season";
import { markTypeToContributions } from "./contributions";
import type {
  AggregatedLeaderboard,
  LeaderboardEntry,
  LeaderboardSection,
  ScoringMark,
} from "./types";
import type { Season } from "./season";

const SECTIONS = [
  { id: "karma-received", title: "Уважаемые люди", bucket: "karmaReceived" },
  { id: "humor-received", title: "Юмористы", bucket: "humorReceived" },
  { id: "karma-plus-given", title: "На позитиве", bucket: "karmaPlusGiven" },
  {
    id: "humor-given",
    title: "Хотят смеяться 5 минут",
    bucket: "humorGiven",
  },
  {
    id: "karma-minus-given",
    title: "Как же у них горит",
    bucket: "karmaMinusGiven",
  },
] as const;

type BucketKey = (typeof SECTIONS)[number]["bucket"];

function accumulateScores(
  marks: ScoringMark[],
  season: Season,
): Record<BucketKey, Map<number, number>> {
  const scores: Record<BucketKey, Map<number, number>> = {
    karmaReceived: new Map(),
    humorReceived: new Map(),
    karmaPlusGiven: new Map(),
    karmaMinusGiven: new Map(),
    humorGiven: new Map(),
  };

  for (const mark of marks) {
    if (!seasonsEqual(mark.season, season)) {
      continue;
    }

    const contributions = markTypeToContributions(mark.type);

    addToBucket(
      scores.karmaReceived,
      mark.subjectId,
      contributions.karmaReceived,
    );
    addToBucket(
      scores.humorReceived,
      mark.subjectId,
      contributions.humorReceived,
    );
    addToBucket(
      scores.karmaPlusGiven,
      mark.actorId,
      contributions.karmaPlusGiven,
    );
    addToBucket(
      scores.karmaMinusGiven,
      mark.actorId,
      contributions.karmaMinusGiven,
    );
    addToBucket(scores.humorGiven, mark.actorId, contributions.humorGiven);
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

  const highestScore = ranked[0]?.score;
  const lowestScore = ranked.at(-1)?.score;

  return ranked.map((entry) => ({
    ...entry,
    isCrown: entry.score === highestScore,
    isChicken: highestScore !== lowestScore && entry.score === lowestScore,
  }));
}

export function aggregateLeaderboard(
  marks: ScoringMark[],
  season: Season,
  now = new Date(),
): AggregatedLeaderboard {
  const scores = accumulateScores(marks, season);
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
