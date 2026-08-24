import type { MarkType } from "@/lib/domain/mark";

/**
 * A Mark as scoring sees it. Carries no Season: the query decides which Marks
 * belong to the Leaderboard period, and aggregation ranks what it is given.
 */
export interface ScoringMark {
  type: MarkType;
  actorId: number;
  subjectId: number;
}

export interface BucketContributions {
  karmaReceived: number;
  humorReceived: number;
  karmaPlusGiven: number;
  karmaMinusGiven: number;
  humorGiven: number;
}

export interface LeaderboardEntry {
  userId: number;
  score: number;
  isCrown: boolean;
  isChicken: boolean;
}

export interface LeaderboardSection {
  id: string;
  title: string;
  entries: LeaderboardEntry[];
}
