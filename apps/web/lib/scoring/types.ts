import type { MarkType } from "@/lib/domain/mark";

import type { Season } from "./season";

export interface ScoringMark {
  type: MarkType;
  actorId: number;
  subjectId: number;
  season: Season;
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

export interface AggregatedLeaderboard {
  season: Season;
  isCurrentSeason: boolean;
  sections: LeaderboardSection[];
}
