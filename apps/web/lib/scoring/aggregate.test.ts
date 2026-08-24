import { describe, expect, it } from "vitest";

import type { MarkType } from "@/lib/domain/mark";

import { aggregateLeaderboard } from "./aggregate";
import {
  getCurrentSeason,
  isSeasonOpenForAction,
  seasonDateRange,
  seasonForDate,
} from "./season";
import type { ScoringMark } from "./types";

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
      isSeasonOpenForAction(messageDate, new Date("2026-01-31T21:09:59.999Z")),
    ).toBe(true);
    expect(
      isSeasonOpenForAction(messageDate, new Date("2026-01-31T21:10:00.000Z")),
    ).toBe(false);
  });
});

function mark(type: MarkType, actorId: number, subjectId: number): ScoringMark {
  return { type, actorId, subjectId };
}

describe("aggregateLeaderboard", () => {
  it("returns five Russian sections with ranked user ids and scores", () => {
    const marks: ScoringMark[] = [
      mark("karma.plus", 10, 20),
      mark("karma.minus", 30, 20),
      mark("humor.add", 10, 40),
      mark("karma.plus", 20, 40),
    ];

    const sections = aggregateLeaderboard(marks);

    expect(sections.map((section) => section.title)).toEqual([
      "Уважаемые люди",
      "Юмористы",
      "На позитиве",
      "Хотят смеяться 5 минут",
      "Как же у них горит",
    ]);

    expect(sections[0]?.entries).toEqual([
      { userId: 40, score: 1, isCrown: true, isChicken: false },
    ]);

    expect(sections[1]?.entries).toEqual([
      { userId: 40, score: 1, isCrown: true, isChicken: false },
    ]);

    expect(sections[2]?.entries).toEqual([
      { userId: 10, score: 1, isCrown: true, isChicken: false },
      { userId: 20, score: 1, isCrown: true, isChicken: false },
    ]);

    expect(sections[3]?.entries).toEqual([
      { userId: 10, score: 1, isCrown: true, isChicken: false },
    ]);

    expect(sections[4]?.entries).toEqual([
      { userId: 30, score: 1, isCrown: true, isChicken: false },
    ]);
  });

  it("computes net karma for Уважаемые люди", () => {
    const marks: ScoringMark[] = [
      mark("karma.plus", 1, 50),
      mark("karma.plus", 2, 50),
      mark("karma.minus", 3, 50),
      mark("karma.plus", 4, 60),
    ];

    const sections = aggregateLeaderboard(marks);
    const karmaReceived = sections[0]?.entries ?? [];

    expect(karmaReceived).toEqual([
      { userId: 50, score: 1, isCrown: true, isChicken: false },
      { userId: 60, score: 1, isCrown: true, isChicken: false },
    ]);
  });

  it("gives all tied entries a Crown and no Chicken", () => {
    const marks: ScoringMark[] = [
      mark("karma.plus", 1, 100),
      mark("karma.plus", 2, 101),
      mark("karma.plus", 3, 102),
    ];

    const sections = aggregateLeaderboard(marks);
    const entries = sections[0]?.entries ?? [];

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
    const marks: ScoringMark[] = [
      mark("karma.plus", 1, 100),
      mark("karma.plus", 2, 100),
      mark("karma.plus", 1, 101),
      mark("karma.plus", 2, 101),
      mark("karma.plus", 1, 102),
      mark("karma.plus", 1, 103),
    ];

    const entries = aggregateLeaderboard(marks)[0]?.entries;

    expect(entries).toEqual([
      { userId: 100, score: 2, isCrown: true, isChicken: false },
      { userId: 101, score: 2, isCrown: true, isChicken: false },
      { userId: 102, score: 1, isCrown: false, isChicken: true },
      { userId: 103, score: 1, isCrown: false, isChicken: true },
    ]);
  });
});
