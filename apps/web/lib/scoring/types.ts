import type { EventType } from '@/lib/domain/event';
import { EVENT_TYPES as DOMAIN_EVENT_TYPES } from '@/lib/domain/event';

import type { Season } from './season';

export const EVENT_TYPES = DOMAIN_EVENT_TYPES;

export type ScoringEvent = {
  type: EventType;
  actorId: number;
  subjectId: number;
  createdAt: Date;
};

export type BucketContributions = {
  karmaReceived: number;
  humorReceived: number;
  karmaPlusGiven: number;
  karmaMinusGiven: number;
  humorGiven: number;
};

export type LeaderboardEntry = {
  userId: number;
  score: number;
  isCrown: boolean;
  isChicken: boolean;
};

export type LeaderboardSection = {
  id: string;
  title: string;
  entries: LeaderboardEntry[];
};

export type AggregatedLeaderboard = {
  season: Season;
  isCurrentSeason: boolean;
  sections: LeaderboardSection[];
};
