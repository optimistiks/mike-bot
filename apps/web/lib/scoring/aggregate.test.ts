import { describe, expect, it } from "vitest";

import type { EventType } from "@/lib/domain/event";

import { aggregateLeaderboard } from "./aggregate";
import { eventTypeToContributions } from "./contributions";
import { EVENT_TYPES } from "./types";
import {
  creditedSeasonForReaction,
  getCurrentSeason,
  seasonDateRange,
  seasonForDate,
} from "./season";
import type { ScoringEvent } from "./types";

describe("eventTypeToContributions", () => {
  it("maps karma.plus to subject karma received and actor karma plus given", () => {
    expect(eventTypeToContributions("karma.plus")).toEqual({
      karmaReceived: 1,
      humorReceived: 0,
      karmaPlusGiven: 1,
      karmaMinusGiven: 0,
      humorGiven: 0,
    });
  });

  it("inverts karma.undo.plus", () => {
    expect(eventTypeToContributions("karma.undo.plus")).toEqual({
      karmaReceived: -1,
      humorReceived: 0,
      karmaPlusGiven: -1,
      karmaMinusGiven: 0,
      humorGiven: 0,
    });
  });

  it("maps karma.minus to negative karma received and actor karma minus given", () => {
    expect(eventTypeToContributions("karma.minus")).toEqual({
      karmaReceived: -1,
      humorReceived: 0,
      karmaPlusGiven: 0,
      karmaMinusGiven: 1,
      humorGiven: 0,
    });
  });

  it("inverts karma.undo.minus", () => {
    expect(eventTypeToContributions("karma.undo.minus")).toEqual({
      karmaReceived: 1,
      humorReceived: 0,
      karmaPlusGiven: 0,
      karmaMinusGiven: -1,
      humorGiven: 0,
    });
  });

  it("maps humor.add to humor received and humor given", () => {
    expect(eventTypeToContributions("humor.add")).toEqual({
      karmaReceived: 0,
      humorReceived: 1,
      karmaPlusGiven: 0,
      karmaMinusGiven: 0,
      humorGiven: 1,
    });
  });

  it("inverts humor.undo.add", () => {
    expect(eventTypeToContributions("humor.undo.add")).toEqual({
      karmaReceived: 0,
      humorReceived: -1,
      karmaPlusGiven: 0,
      karmaMinusGiven: 0,
      humorGiven: -1,
    });
  });
});

describe("EVENT_TYPES", () => {
  it("exports all six v2 event types", () => {
    expect(EVENT_TYPES).toEqual([
      "karma.plus",
      "karma.undo.plus",
      "karma.minus",
      "karma.undo.minus",
      "humor.add",
      "humor.undo.add",
    ]);
  });
});

describe("season bucketing", () => {
  it("uses Europe/Moscow midnight boundaries", () => {
    const augustSeason = { year: 2026, month: 8 };

    // 2026-07-31T20:59:59.999Z = 2026-07-31 23:59:59 Moscow
    expect(seasonForDate(new Date("2026-07-31T20:59:59.999Z"))).not.toEqual(
      augustSeason,
    );

    // 2026-07-31T21:00:00.000Z = 2026-08-01 00:00:00 Moscow
    expect(seasonForDate(new Date("2026-07-31T21:00:00.000Z"))).toEqual(
      augustSeason,
    );
  });

  it("derives Current Season from today in Moscow", () => {
    const frozenNow = new Date("2026-08-15T12:00:00.000Z");
    expect(getCurrentSeason(frozenNow)).toEqual({ year: 2026, month: 8 });
  });

  it("returns half-open UTC query bounds for a Moscow Season", () => {
    expect(seasonDateRange({ year: 2026, month: 12 })).toEqual({
      start: new Date("2026-11-30T21:00:00.000Z"),
      end: new Date("2026-12-31T21:00:00.000Z"),
    });
  });

  it("keeps a message Season open for exactly ten minutes", () => {
    const messageDate = new Date("2026-01-31T20:00:00.000Z");

    expect(
      creditedSeasonForReaction(
        messageDate,
        new Date("2026-01-31T21:09:59.999Z"),
      ),
    ).toEqual({ year: 2026, month: 1 });
    expect(
      creditedSeasonForReaction(
        messageDate,
        new Date("2026-01-31T21:10:00.000Z"),
      ),
    ).toBeNull();
  });
});

function event(
  type: EventType,
  actorId: number,
  subjectId: number,
  createdAt: string,
): ScoringEvent {
  return {
    type,
    actorId,
    subjectId,
    season: seasonForDate(new Date(createdAt)),
  };
}

describe("aggregateLeaderboard", () => {
  const august2026 = { year: 2026, month: 8 };

  it("returns five Russian sections with ranked user ids and scores", () => {
    const events: ScoringEvent[] = [
      event("karma.plus", 10, 20, "2026-08-05T12:00:00.000Z"),
      event("karma.minus", 30, 20, "2026-08-06T12:00:00.000Z"),
      event("humor.add", 10, 40, "2026-08-07T12:00:00.000Z"),
      event("karma.plus", 20, 40, "2026-08-08T12:00:00.000Z"),
    ];

    const result = aggregateLeaderboard(events, august2026);

    expect(result.sections.map((section) => section.title)).toEqual([
      "Уважаемые люди",
      "Юмористы",
      "На позитиве",
      "Хотят смеяться 5 минут",
      "Как же у них горит",
    ]);

    expect(result.sections[0]?.entries).toEqual([
      { userId: 40, score: 1, isCrown: true, isChicken: false },
    ]);

    expect(result.sections[1]?.entries).toEqual([
      { userId: 40, score: 1, isCrown: true, isChicken: false },
    ]);

    expect(result.sections[2]?.entries).toEqual([
      { userId: 10, score: 1, isCrown: true, isChicken: false },
      { userId: 20, score: 1, isCrown: true, isChicken: false },
    ]);

    expect(result.sections[3]?.entries).toEqual([
      { userId: 10, score: 1, isCrown: true, isChicken: false },
    ]);

    expect(result.sections[4]?.entries).toEqual([
      { userId: 30, score: 1, isCrown: true, isChicken: false },
    ]);
  });

  it("computes net karma for Уважаемые люди", () => {
    const events: ScoringEvent[] = [
      event("karma.plus", 1, 50, "2026-08-01T12:00:00.000Z"),
      event("karma.plus", 2, 50, "2026-08-02T12:00:00.000Z"),
      event("karma.minus", 3, 50, "2026-08-03T12:00:00.000Z"),
      event("karma.plus", 4, 60, "2026-08-04T12:00:00.000Z"),
    ];

    const result = aggregateLeaderboard(events, august2026);
    const karmaReceived = result.sections[0]?.entries ?? [];

    expect(karmaReceived).toEqual([
      { userId: 50, score: 1, isCrown: true, isChicken: false },
      { userId: 60, score: 1, isCrown: true, isChicken: false },
    ]);
  });

  it("applies undo events by inverting contributions", () => {
    const events: ScoringEvent[] = [
      event("karma.plus", 1, 70, "2026-08-01T12:00:00.000Z"),
      event("karma.undo.plus", 1, 70, "2026-08-02T12:00:00.000Z"),
      event("humor.add", 2, 80, "2026-08-03T12:00:00.000Z"),
      event("humor.undo.add", 2, 80, "2026-08-04T12:00:00.000Z"),
    ];

    const result = aggregateLeaderboard(events, august2026);

    expect(result.sections[0]?.entries).toEqual([]);
    expect(result.sections[1]?.entries).toEqual([]);
    expect(result.sections[2]?.entries).toEqual([]);
    expect(result.sections[4]?.entries).toEqual([]);
  });

  it("filters events outside the requested Season", () => {
    const events: ScoringEvent[] = [
      event("karma.plus", 1, 90, "2026-07-15T12:00:00.000Z"),
      event("karma.plus", 1, 91, "2026-08-15T12:00:00.000Z"),
    ];

    const result = aggregateLeaderboard(events, august2026);

    expect(result.sections[0]?.entries).toEqual([
      { userId: 91, score: 1, isCrown: true, isChicken: false },
    ]);
  });

  it("gives all tied entries a Crown and no Chicken", () => {
    const events: ScoringEvent[] = [
      event("karma.plus", 1, 100, "2026-08-01T12:00:00.000Z"),
      event("karma.plus", 2, 101, "2026-08-02T12:00:00.000Z"),
      event("karma.plus", 3, 102, "2026-08-03T12:00:00.000Z"),
    ];

    const result = aggregateLeaderboard(events, august2026);
    const entries = result.sections[0]?.entries ?? [];

    expect(entries[0]).toMatchObject({
      userId: 100,
      score: 1,
      isCrown: true,
      isChicken: false,
    });
    expect(entries[1]).toMatchObject({
      userId: 101,
      score: 1,
      isCrown: true,
      isChicken: false,
    });
    expect(entries[2]).toMatchObject({
      userId: 102,
      score: 1,
      isCrown: true,
      isChicken: false,
    });
  });

  it("gives flair to every tied highest and tied lowest score", () => {
    const events: ScoringEvent[] = [
      event("karma.plus", 1, 100, "2026-08-01T12:00:00.000Z"),
      event("karma.plus", 2, 100, "2026-08-01T12:00:00.000Z"),
      event("karma.plus", 1, 101, "2026-08-01T12:00:00.000Z"),
      event("karma.plus", 2, 101, "2026-08-01T12:00:00.000Z"),
      event("karma.plus", 1, 102, "2026-08-01T12:00:00.000Z"),
      event("karma.plus", 1, 103, "2026-08-01T12:00:00.000Z"),
    ];

    const entries = aggregateLeaderboard(events, august2026).sections[0]
      ?.entries;

    expect(entries).toEqual([
      { userId: 100, score: 2, isCrown: true, isChicken: false },
      { userId: 101, score: 2, isCrown: true, isChicken: false },
      { userId: 102, score: 1, isCrown: false, isChicken: true },
      { userId: 103, score: 1, isCrown: false, isChicken: true },
    ]);
  });

  it("flags Current Season when the requested Season matches today in Moscow", () => {
    const frozenNow = new Date("2026-08-19T12:00:00.000Z");
    const result = aggregateLeaderboard([], august2026, frozenNow);

    expect(result.isCurrentSeason).toBe(true);
    expect(result.season).toEqual(august2026);
  });
});
