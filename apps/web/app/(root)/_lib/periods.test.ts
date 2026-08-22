import { afterEach, describe, expect, it, vi } from "vitest";

import {
  availableSeasonSet,
  currentPeriod,
  isCurrentPeriod,
  leaderboardHref,
  periodKey,
  periodLabel,
  pickableYears,
} from "./periods";

const CHAT_ID = -100_123;

afterEach(() => {
  vi.useRealTimers();
});

/** 2026-08-15 12:00 UTC is 15:00 in Moscow, so the Current Season is 2026-08. */
function freezeMoscowAugust2026(): void {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-08-15T12:00:00.000Z"));
}

describe("leaderboardHref", () => {
  it("addresses a Season by zero-padded month", () => {
    expect(
      leaderboardHref(CHAT_ID, { kind: "season", year: 2026, month: 8 }),
    ).toBe("/chats/-100123/leaderboards/2026/08");
  });

  it("addresses a year with no month segment at all", () => {
    expect(leaderboardHref(CHAT_ID, { kind: "year", year: 2026 })).toBe(
      "/chats/-100123/leaderboards/2026",
    );
  });

  it("accepts a bare Season, so callers holding one need no wrapper", () => {
    expect(leaderboardHref(CHAT_ID, { year: 2025, month: 12 })).toBe(
      "/chats/-100123/leaderboards/2025/12",
    );
  });
});

describe("periodLabel", () => {
  it("names a Season by Russian month and year", () => {
    expect(periodLabel({ kind: "season", year: 2026, month: 8 })).toBe(
      "АВГУСТ 2026",
    );
    expect(periodLabel({ kind: "season", year: 2026, month: 1 })).toBe(
      "ЯНВАРЬ 2026",
    );
  });

  it("names a year as the whole year", () => {
    expect(periodLabel({ kind: "year", year: 2026 })).toBe("2026 · ВЕСЬ ГОД");
  });
});

describe("periodKey", () => {
  it("never collides a year with a Season of the same year", () => {
    expect(periodKey({ kind: "year", year: 2026 })).not.toBe(
      periodKey({ kind: "season", year: 2026, month: 1 }),
    );
  });
});

describe("isCurrentPeriod", () => {
  it("recognises the Current Season in Moscow", () => {
    freezeMoscowAugust2026();

    expect(isCurrentPeriod({ kind: "season", year: 2026, month: 8 })).toBe(
      true,
    );
    expect(isCurrentPeriod({ kind: "season", year: 2026, month: 7 })).toBe(
      false,
    );
  });

  it("is never true for a year, which is not a Season", () => {
    freezeMoscowAugust2026();

    expect(isCurrentPeriod({ kind: "year", year: 2026 })).toBe(false);
  });
});

describe("currentPeriod", () => {
  it("opens on the Current Season", () => {
    freezeMoscowAugust2026();

    expect(currentPeriod()).toEqual({ kind: "season", year: 2026, month: 8 });
  });
});

describe("pickableYears", () => {
  it("spans every year from the earliest Season to the current one", () => {
    freezeMoscowAugust2026();

    expect(
      pickableYears([
        { year: 2024, month: 3 },
        { year: 2024, month: 4 },
      ]),
    ).toEqual([2024, 2025, 2026]);
  });

  it("offers the current year alone when there are no Seasons yet", () => {
    freezeMoscowAugust2026();

    expect(pickableYears([])).toEqual([2026]);
  });
});

describe("availableSeasonSet", () => {
  it("answers which months the picker may offer", () => {
    const available = availableSeasonSet([
      { year: 2026, month: 7 },
      { year: 2026, month: 8 },
    ]);

    expect(available.has("2026-8")).toBe(true);
    expect(available.has("2026-9")).toBe(false);
  });
});
