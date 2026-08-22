import type { EventType } from "@/lib/domain/event";
import { EVENT_TYPES as DOMAIN_EVENT_TYPES } from "@/lib/domain/event";

import type { Season } from "./season";

export const EVENT_TYPES = DOMAIN_EVENT_TYPES;

export interface ScoringEvent {
  type: EventType;
  actorId: number;
  subjectId: number;
  isReversal: boolean;
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
