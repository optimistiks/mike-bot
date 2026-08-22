import "server-only";

import { faker } from "@faker-js/faker";

import type { LeaderboardResponse } from "@/lib/leaderboard/schema";
import {
  aggregateLeaderboard,
  type ScoringEvent,
  type Season,
} from "@/lib/scoring";

import { findPrototypeChat, PROTOTYPE_CHATS } from "./chats";
import { PROTOTYPE_SECTIONS } from "./sections";
import {
  isCurrentSeason,
  monthsWithData,
  seasonHasData,
  type PrototypeSeason,
} from "./seasons";

/**
 * Deterministic Leaderboard fixtures, generated on the server.
 *
 * The one seam in this prototype: everything below produces the production
 * `LeaderboardResponse` shape by running the production scoring module over
 * generated Events. Pointing the components at the real endpoint later needs no
 * component changes, and Crown/Chicken behave exactly as they will in
 * production because production's own aggregation decides them.
 *
 * Faker is a devDependency and this module is `server-only`, so none of it can
 * reach a phone.
 */

const ROSTER_SIZE = 12;

/** The Season whose Crown tie is guaranteed, so the layout is always exercised. */
const CROWN_TIE_MONTH = 3;

export interface RosterMember {
  userId: number;
  displayName: string;
}

/**
 * Weighted so Karma plus dominates, undo Events stay rare, and Karma minus is
 * common enough that the burn section has something to show.
 */
const EVENT_WEIGHTS = [
  { weight: 45, value: "karma.plus" },
  { weight: 28, value: "humor.add" },
  { weight: 16, value: "karma.minus" },
  { weight: 4, value: "karma.undo.plus" },
  { weight: 4, value: "karma.undo.minus" },
  { weight: 3, value: "humor.undo.add" },
] as const;

function chatIndex(chatId: number): number {
  const index = PROTOTYPE_CHATS.findIndex((chat) => chat.id === chatId);
  return index === -1 ? 0 : index;
}

/**
 * The roster is seeded by Chat alone, so the same people appear every Season. A
 * group chat's membership does not churn monthly.
 */
export function chatRoster(chatId: number): RosterMember[] {
  const index = chatIndex(chatId);
  faker.seed(1_000 + index);

  return Array.from({ length: ROSTER_SIZE }, (_, slot) => ({
    userId: (index + 1) * 100 + slot,
    // One handle per Chat is stretched past 24 characters on purpose: the
    // standings entry has to give it a full line and let it wrap.
    displayName:
      slot === 3
        ? `@${faker.internet.username()}_${faker.internet.username()}`.toLowerCase()
        : `@${faker.internet.username()}`.toLowerCase(),
  }));
}

/** Scores reseed per Chat, year, and month, so Crowns move between Seasons. */
function seasonSeed(chatId: number, season: Season): number {
  return (chatIndex(chatId) + 1) * 1_000_000 + season.year * 100 + season.month;
}

function seasonEvents(chatId: number, season: Season): ScoringEvent[] {
  const roster = chatRoster(chatId);
  faker.seed(seasonSeed(chatId, season));

  const events: ScoringEvent[] = [];
  const eventCount = faker.number.int({ min: 600, max: 1_400 });

  for (let index = 0; index < eventCount; index += 1) {
    const actorSlot = faker.number.int({ min: 0, max: ROSTER_SIZE - 1 });
    const subjectOffset = faker.number.int({ min: 1, max: ROSTER_SIZE - 1 });
    // Both indices are inside the roster by construction, and the non-zero
    // offset keeps an Actor from marking their own message.
    const actor = roster[actorSlot];
    const subject = roster[(actorSlot + subjectOffset) % ROSTER_SIZE];

    events.push({
      type: faker.helpers.weightedArrayElement(EVENT_WEIGHTS),
      actorId: actor.userId,
      subjectId: subject.userId,
      season,
    });
  }

  return season.month === CROWN_TIE_MONTH
    ? withCrownTie(events, season, roster)
    : events;
}

/**
 * Crown is tie-inclusive per the glossary, so at least one Season has to render
 * more than one. Rather than fabricate the entries, lift the Юмористы runner-up
 * to the leader's total with real Humor Marks and let production's aggregation
 * award both Crowns.
 */
function withCrownTie(
  events: ScoringEvent[],
  season: Season,
  roster: RosterMember[],
): ScoringEvent[] {
  const humor = aggregateLeaderboard(events, season).sections.find(
    (section) => section.id === "humor-received",
  );
  const leader = humor?.entries[0];
  const runnerUp = humor?.entries[1];

  if (!leader || !runnerUp) return events;

  const gap = leader.score - runnerUp.score;
  const actor = roster.find((member) => member.userId !== runnerUp.userId);

  if (gap <= 0 || !actor) return events;

  return [
    ...events,
    ...Array.from({ length: gap }, () => ({
      type: "humor.add" as const,
      actorId: actor.userId,
      subjectId: runnerUp.userId,
      season,
    })),
  ];
}

/**
 * A year is the sum of its months, by construction: the year's Events are
 * concatenated and credited to one Season, so the same aggregation that ranks a
 * month ranks the year.
 */
function eventsForSeason(
  chatId: number,
  season: PrototypeSeason,
  now: Date,
): { events: ScoringEvent[]; creditedTo: Season } {
  if (season.month !== undefined) {
    const month: Season = { year: season.year, month: season.month };

    return {
      events: seasonHasData(month, now) ? seasonEvents(chatId, month) : [],
      creditedTo: month,
    };
  }

  const creditedTo: Season = { year: season.year, month: 1 };
  const events = monthsWithData(season.year, now).flatMap((month) =>
    seasonEvents(chatId, { year: season.year, month }).map((event) => ({
      ...event,
      season: creditedTo,
    })),
  );

  return { events, creditedTo };
}

/**
 * The full-year view has no month, which the production `LeaderboardResponse`
 * cannot express. Sections and entries are exactly the production shape; only
 * the Season descriptor widens, and only until the domain model catches up.
 */
export type PrototypeLeaderboard = Omit<LeaderboardResponse, "season"> & {
  season: PrototypeSeason;
};

export function buildLeaderboard(
  chatId: number,
  season: PrototypeSeason,
  now = new Date(),
): PrototypeLeaderboard {
  const displayNames = new Map(
    chatRoster(chatId).map((member) => [member.userId, member.displayName]),
  );
  const { events, creditedTo } = eventsForSeason(chatId, season, now);
  const aggregated = aggregateLeaderboard(events, creditedTo, now);
  const byId = new Map(
    aggregated.sections.map((section) => [section.id, section]),
  );

  return {
    chatId,
    season,
    isCurrentSeason: isCurrentSeason(season, now),
    // The prototype's own titles and order, mapped onto production's section
    // ids. Production's scoring module keeps its names.
    sections: PROTOTYPE_SECTIONS.map((section) => ({
      id: section.id,
      title: section.title,
      entries: (byId.get(section.id)?.entries ?? []).map((entry) => ({
        userId: entry.userId,
        displayName:
          displayNames.get(entry.userId) ?? `@user${String(entry.userId)}`,
        score: entry.score,
        isCrown: entry.isCrown,
        isChicken: entry.isChicken,
      })),
    })),
  };
}

export { findPrototypeChat };
